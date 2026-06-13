# Multi-Print Shopping Cart — Design

**Date:** 2026-06-13
**Branch:** `feat/AR-129-implement-shopping-cart` (branch 2 of a 3-fold task)
**Status:** Approved design (user pre-approved; "if not good, we revert the branch")

## Goal

Let buyers purchase one *or more* prints in a single order with one consolidated
shipment and one payment, and move the delivery-address form to the very end of
the flow. Today the print flow is single-print only: a buyer runs the whole
wizard + payment per print and pays a separate shipping fee each time.

Two user-facing pillars:
1. **Address at the end.** The wizard only configures and prices an item; address,
   shipping, VAT, and final totals appear only at checkout.
2. **One order, many prints.** Add-to-cart, quantity per line, mixed artists
   allowed, one PaymentIntent, one parcel.

## Confirmed facts & decisions

- **TPS multi-item:** CONFIRMED — one TPS order may contain multiple different
  artworks, shipped together as one parcel.
- **TPS shipping charge:** flat per shipment (one fixed fee per destination,
  independent of item count). "Buy more, ship once" is a genuine selling point.
- **Quantity:** Amazon-style `quantity` per line item (no duplicate rows).
- **Limited-edition stock cap:** quantity capped at remaining available
  (UI + server re-check). Open editions: uncapped.
- **Timed hold:** adding a limited print to cart reserves the edition number(s)
  server-side with a TTL; a visible buyer countdown mirrors the server clock.
- **Edition-sales ledger:** the existing admin ledger (buyer + assigned number
  per variant for every sale) must survive the header/line-item split with zero
  capability loss.
- **Refunds:** whole-order only for v1; per-item refunds deferred.
- **Guest checkout stays:** buyers are not logged in; name/email/address entered
  fresh at checkout.

## Out of scope (explicit)

- Per-item (partial) refunds.
- Saved carts / accounts / "buy it again."
- Any change to the 3D wizard preview itself beyond its terminal CTA.
- Discount codes, gift options.

---

## 1. Data model — split `PrintOrder` into header + line items

`PrintOrder` today carries both order-level fields (buyer, address, payment) and
per-print fields (artworkId, printConfig, per-item money, payout). The split
moves per-print fields to a new child table.

### `PrintOrder` (header) — fields that REMAIN / change

Keep (order-level): `id`, `paymentIntentId` (unique), `buyerEmail`, `buyerName`,
`shippingAddress` (Json), `country`, `currency`, `paymentStatus`,
`fulfillmentStatus`, `trackingUrl`, `shippedAt`, `tpsEditionMirroredAt`,
`createdAt`, `updatedAt`, `events`.

Change to order-level totals (sums over line items):
- `totalCents` — grand total (sum of item totals + shipping + VAT).
- `customerVatCents` — VAT on the whole order.
- `productionShippingCents` → rename intent kept: **one** consolidated shipping
  line for the order (flat per destination).

REMOVE from header (move to line item): `artworkId`, `artistUserId`,
`printConfig`, `artistCents`, `galleryCents`, `productionCents`, and the
per-order `transferId`/`transferStatus`/`paidOutAt` (payouts become per-item).

KEEP temporarily: `certificateUrl` is already DEPRECATED on the header; leave the
column as-is (additive-against-prod rule) — line-item COAs live on the child.

### `PrintOrderItem` (new child) — one row per distinct print

```
model PrintOrderItem {
  id           String   @id @default(uuid())
  orderId      String
  order        PrintOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  artworkId    String
  artwork      Artwork @relation(fields: [artworkId], references: [id], onDelete: Restrict)
  artistUserId String
  artistUser   User    @relation(fields: [artistUserId], references: [id], onDelete: Restrict)

  printConfig  Json     // WizardConfig snapshot for this item
  quantity     Int      @default(1)

  // Per-UNIT amounts in cents; line total = unit × quantity. Stored as
  // line totals (already multiplied) to match how the order total sums.
  productionCents Int
  artistCents     Int
  galleryCents    Int

  // Per-item Stripe Connect payout (mixed artists each paid independently).
  // 'pending' | 'paid' | 'reversed'
  transferId     String?
  transferStatus String?
  paidOutAt      DateTime?

  certificateUrl String?  // one COA per item

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  editionNumbers EditionNumber[]

  @@index([orderId])
  @@index([artistUserId])
  @@index([transferStatus])
}
```

### `EditionNumber` re-links to the line item

Change `orderId`/`order` (→ `PrintOrder`) to `orderItemId`/`orderItem`
(→ `PrintOrderItem`). A limited line with `quantity = 2` owns two `EditionNumber`
rows, each with the buyer's email. The `@@unique([variantId, number])` constraint
and the atomic `FOR UPDATE SKIP LOCKED` claim are UNCHANGED — the no-duplicate
guarantee is preserved. `buyerEmail` denormalization stays for the ledger.

> Migration note: schema.prisma is edited in this branch, but the DB push is run
> by the user (project rule — never run prisma migrate/db push from here). Because
> prod `main` still reads the old shape, the change must be additive where
> possible; the header column removals are applied to dev/staging DB only after
> AR-129 is the live branch (sequenced in the plan, executed by the user).

---

## 2. Cart & checkout flow

### Wizard (configure one item, item-price only)
- Both OpenWizard and LimitedWizard keep their current configuration UIs and 3D
  preview. The SummaryPanel shows **item price only** — no shipping, no VAT,
  no address.
- Terminal CTA changes from "Add shipping address" to **"Add to cart."** After
  adding, surface **"Continue Shopping"** and **"Go to cart."**

### Cart (client state; localStorage)
- localStorage stores **selections only** (artworkId, variantId for limited,
  WizardConfig, quantity) — it is NOT the stock authority.
- Header gets a **cart icon with item count**.
- Cart page: list of items (thumbnail respecting aspect ratio, specs, unit
  price), quantity stepper (capped for limited), remove, running subtotal.
  Still **item prices only** — no shipping/VAT yet.
- CTA: **"Continue to checkout."**

### Checkout (address first asked here)
1. Address + buyer-info form (name, email, shipping address, country). First and
   only time the address is collected.
2. Checkout summary: all items + quantities, **flat shipping** for the country,
   **VAT**, **final total**, and a "change address" link.
3. Stripe payment step → **one PaymentIntent** for the whole cart, manual capture
   (`capture_method: 'manual'`), as today.

### Server-side pending cart (replaces Stripe-metadata config)
- Stripe metadata cannot hold a multi-item cart (500-char limit). Instead, persist
  a **pending cart** server-side keyed by the PaymentIntent id (a small table or a
  JSON blob keyed by PI id) containing the validated line items + computed money.
- The webhook (`payment_intent.amount_capturable_updated`) reads the pending cart
  and creates `PrintOrder` + N `PrintOrderItem` rows, then binds reserved
  `EditionNumber` rows to their line items.
- Pending cart is cleared after the order is created (and on cancel/fail).

### Server re-validation at checkout (loop existing defenses over items)
For every line item, server re-checks: print-enabled, per-artwork restrictions,
destination shippable, and re-quotes price server-side. Existing single-item
guards are applied per item. Totals are recomputed server-side; client numbers
are display-only.

---

## 3. Limited-edition stock: caps, holds, countdown

### Quantity cap
- Open editions: unlimited.
- Limited: quantity per line capped at **remaining available** for the variant,
  enforced in the cart UI AND re-checked server-side at checkout (UI cap can go
  stale if stock changes while the cart sits).

### Timed hold (the "book reservation")
- Adding a limited print to cart creates a server-side reservation: one
  `EditionNumber` per unit moves `available → reserved` with `reservedAt = now`,
  claimed atomically (lowest available numbers). Open editions: no hold.
- **TTL ~10–15 min.** The **server owns the clock.** A sweep — cron job and/or
  lazy-on-read check — releases reservations older than the TTL back to
  `available`. The client's localStorage clock is never trusted to expire a hold
  (a closed tab would otherwise hold forever).
- Re-adding / still-active cart refreshes the hold's `reservedAt`.

### Buyer countdown
- When a hold is created, the server returns `expiresAt`. The cart/checkout UI
  shows a countdown mirroring it ("You have 5 minutes left to complete this
  order").
- At checkout submit, the server re-verifies the held numbers. If a hold lapsed
  and the number sold, show a minimal-friction message and re-reserve if stock
  remains; otherwise the item drops with a clear notice.
- Exact copy + whether the timer is always visible vs. shown only when low: to be
  finalized during implementation; behavior contract is "server clock decides."

---

## 4. Admin — preserved + extended

- **Edition-sales ledger** (`/admin`): unchanged capability — buyer (email/name)
  + assigned number per variant for every completed limited sale. It now reads
  through `EditionNumber → PrintOrderItem → PrintOrder`; a `quantity = 2` line
  shows two numbered rows, each buyer-attributed.
- **Order list**: a row may now represent multiple items; show item count and
  summed totals; keep payment/fulfillment/payout status columns.
- **Order detail**: renders N line items (artwork, specs, qty, per-item money).
  **Payouts are per-line-item** — each artist in a mixed-artist order gets an
  independent Stripe Connect transfer; an order can be "partly paid out."
  `markPlaced` (capture) and fulfillment remain order-level (one parcel, one
  tracking URL).
- **Payouts page**: lists per-item transfers (was per-order); one multi-artist
  order can produce several payout rows.

## 5. Payment, capture, refunds

- **Auth → capture** unchanged: one PI per cart, `capture_method: 'manual'`;
  admin `markPlaced` captures once the order is placed at TPS.
- **Webhook events** unchanged in set; their handlers now operate on the header +
  items: `amount_capturable_updated` creates the order + items from the pending
  cart; `succeeded` flips header `paymentStatus`; `canceled`/`payment_failed`
  release all reserved edition numbers for the PI and clear the pending cart.
- **Refunds (v1): whole-order only.** Reverse the PI; release/cancel all line
  items' payouts as applicable; set header `paymentStatus = 'refunded'`. Per-item
  refunds explicitly deferred.

## Error handling

- Reservation race: atomic claim already guarantees first-writer-wins; the loser
  gets a clean "no longer available," never a duplicate.
- Hold expiry mid-checkout: server re-verify path (Section 3).
- Pending-cart/webhook mismatch: if the pending cart is missing when the webhook
  fires, log a `PrintOrderEvent`-style error + admin alert; do not create a
  partial order.
- Per-item re-validation failure at checkout: the offending item is flagged and
  the buyer is returned to the cart with a specific message; no PI is created.

## Testing

- Playwright e2e only (project rule); 3D/WebGL scenes excluded from e2e.
- Cart/checkout logic is testable without WebGL: the existing Stripe-isolation
  pattern (seed selections, deep-link to the checkout/payment step, assert PI
  state via Stripe API) extends to multi-item carts.
- Reservation/TTL and per-item payout logic are server-side and unit-testable via
  e2e API-level specs against the test DB.
- No new test framework; no real emails in e2e (existing rule/quota).

## Key files (current single-print flow to migrate)

- `prisma/schema.prisma` — `PrintOrder` (~307), `EditionNumber` (~270),
  `LimitedVariant` (~231), `PrintOrderEvent` (~374).
- `src/components/PrintWizard/index.tsx`, `LimitedWizard.tsx`, `SummaryPanel.tsx`,
  `VariantPicker.tsx` — wizard + terminal CTA.
- `src/components/checkout/PrintCheckout/createPaymentIntent.ts` — PI creation,
  metadata, idempotency, reservation call.
- `src/lib/orders/createPrintOrderFromPaymentIntent.ts` — order creation from
  webhook.
- `src/app/api/webhooks/stripe/route.ts` — Stripe event handlers.
- `src/lib/editions/reserveEditionNumber.ts`, `releaseEditionNumber.ts` —
  reservation primitives (reused, extended for cart-time holds + TTL sweep).
- `src/app/admin/orders/actions.ts`, `src/components/admin/orders/` — admin list,
  detail, payouts.
- `src/components/admin/edition-sales/index.tsx` — ledger view (must be preserved).
- `src/components/ui/Header/` — add cart icon.
- `src/lib/print-providers/printspace/getQuote.ts`, `pricing.ts` — shipping/VAT
  (flat shipping per destination).

## Decomposition for the plan

The implementation plan will sequence these as independently-shippable phases:
1. Schema: add `PrintOrderItem`, re-link `EditionNumber` (user runs db push).
2. Cart client state + localStorage + header icon (no checkout yet).
3. Wizard terminal CTA → add-to-cart.
4. Cart page (items, quantity, remove, subtotal).
5. Cart-time reservation + TTL sweep + countdown (limited editions).
6. Checkout: address form, server re-validation per item, flat shipping + VAT.
7. Pending cart + one PI for the cart.
8. Webhook → create header + line items; bind edition numbers.
9. Admin: order detail multi-item, per-item payouts, payouts page, ledger relink.
10. Whole-order refund.
11. e2e for the multi-item happy path + reservation/expiry.
