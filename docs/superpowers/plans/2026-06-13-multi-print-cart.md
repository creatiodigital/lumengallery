# Multi-Print Shopping Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let buyers add one or more prints to a cart and purchase them in a single order with one consolidated (flat) shipment and one PaymentIntent, with the delivery address collected only at checkout.

**Architecture:** Split `PrintOrder` into a header + new `PrintOrderItem` child table; `EditionNumber` re-links to the line item. Cart selections live in localStorage (client) while the authoritative limited-edition holds live server-side on `EditionNumber` (reserved at add-to-cart, TTL-swept). One PI per cart, manual capture; a server-side pending cart keyed by PI id feeds the webhook that creates the header + items. Per-item Stripe Connect payouts; whole-order refund for v1.

**Tech Stack:** Next.js App Router (server actions + route handlers), Prisma/Postgres, Stripe (manual capture + Connect), Playwright e2e (no unit framework; 3D/WebGL excluded from e2e).

**Spec:** `docs/superpowers/specs/2026-06-13-multi-print-cart-design.md`

---

## Workflow rules that OVERRIDE default plan habits

- **NEVER run `prisma migrate` / `prisma db push` from here.** Schema edits go in `schema.prisma`; the **user** runs the DB push (a reset prompt once wiped the dev DB). Tasks that touch schema STOP after editing the file + `pnpm db:generate` and hand off to the user. Never suggest a specific migrate/push command.
- **No commit until the user has tested and approved**; **no push until the user says push**; never merge locally; no `Co-Authored-By` trailer.
- Tests are Playwright e2e in `/e2e/` only. Never propose Vitest/Jest. No e2e that mounts the WebGL wizard/scene — use the Stripe-isolation pattern (seed state, deep-link to checkout/payment, assert PI via Stripe API).
- Money always in cents; sizes display **height × width** in **cm**; client-facing controls squared; use `<Button />` never native; no `!important`; no `var(--token, fallback)`; no new dependency without explicit approval.
- Never use real artist data in fixtures — use "John Doe".
- This branch is large: each Task below is an independently-reviewable unit. Commit per task (after user OK at the gates noted).

---

## Phase / Task overview

1. Schema: `PrintOrderItem` + re-link `EditionNumber` (USER runs db push)
2. Cart domain types + money helpers (pure, testable)
3. Cart client store (localStorage) + header cart icon
4. Wizard terminal CTA → add-to-cart
5. Cart page (items, quantity, remove, subtotal)
6. Cart-time reservation + TTL sweep + countdown (limited editions)
7. Checkout: address form + per-item server re-validation + flat shipping + VAT
8. Pending cart + one PaymentIntent for the cart
9. Webhook → create header + line items; bind edition numbers
10. Admin: multi-item order detail, per-item payouts, payouts page, ledger relink
11. Whole-order refund + e2e (multi-item happy path + reservation/expiry)

---

## Task 1: Schema — `PrintOrderItem` + re-link `EditionNumber`

**Files:**

- Modify: `prisma/schema.prisma` (PrintOrder ~307, EditionNumber ~270)

- [ ] **Step 1.1: Add `PrintOrderItem` model** (after `PrintOrder`):

```prisma
model PrintOrderItem {
  id      String     @id @default(uuid())
  orderId String
  order   PrintOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  artworkId    String
  artwork      Artwork @relation(fields: [artworkId], references: [id], onDelete: Restrict)
  artistUserId String
  artistUser   User    @relation(fields: [artistUserId], references: [id], onDelete: Restrict)

  printConfig Json
  quantity    Int  @default(1)

  // Line totals in cents (unit × quantity).
  productionCents Int
  artistCents     Int
  galleryCents    Int

  // Per-item Stripe Connect payout (mixed-artist orders pay each independently).
  transferId     String?
  transferStatus String? // 'pending' | 'paid' | 'reversed'
  paidOutAt      DateTime?

  certificateUrl String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  editionNumbers EditionNumber[]

  @@index([orderId])
  @@index([artistUserId])
  @@index([transferStatus])
}
```

- [ ] **Step 1.2: Re-link `EditionNumber`** — replace its `orderId`/`order` block:

```prisma
  // was: orderId String? @unique + order PrintOrder?
  orderItemId String?         @unique
  orderItem   PrintOrderItem? @relation(fields: [orderItemId], references: [id], onDelete: SetNull)
```

- [ ] **Step 1.3: Add back-relations ADDITIVELY (no removals in this task).** On `PrintOrder` add `items PrintOrderItem[]` and keep ALL existing fields untouched. On `EditionNumber` keep the existing `orderId`/`order` (relation name `"PrintOrderEditionNumber"`) alongside the new `orderItemId`/`orderItem`. On `Artwork` and `User`, ADD `printOrderItems PrintOrderItem[]` and KEEP the existing `printOrders PrintOrder[]`.

  **Why additive (deviation from first draft):** removing PrintOrder's per-print columns immediately breaks the single-print order-creation + admin code (51 typecheck errors) and the "nothing breaks mid-migration" principle, and it's a non-additive change on the shared dev/staging DB. Instead: this task is purely additive (new table + new nullable FK), so existing code compiles unchanged and every later task stays independently testable. PrintOrder's legacy per-print columns are made nullable in **Task 9** (when cart order-creation needs it and those consumers are being rewritten), and the dead columns/relations are dropped in a final cleanup task once AR-129 is the live branch (mirrors the existing `certificateUrl` deprecation pattern).

- [ ] **Step 1.4: Generate client only** (NO db push):

Run: `pnpm db:generate`
Expected: exit 0, Prisma client regenerates.

- [ ] **Step 1.5: HANDOFF — user runs db push.** STOP. Tell the user the schema is ready and they must run the dev/staging DB push themselves. Do not run it; do not suggest a specific command. Wait for confirmation before any task that reads the new tables at runtime.

> Commit gate: commit schema after the user confirms the push succeeded and `pnpm typecheck` passes (generated types resolve).

---

## Task 2: Cart domain types + money helpers (pure, testable)

**Files:**

- Create: `src/lib/cart/types.ts`
- Create: `src/lib/cart/cartMath.ts`
- Test: `e2e/cart-math.spec.ts` (API-level, no WebGL)

- [ ] **Step 2.1: Define types** in `src/lib/cart/types.ts`:

```ts
import type { ProviderId, WizardConfig } from '@/lib/print-providers'

export type CartItem = {
  // Stable per-line id (uuid) so quantity edits/removes target one line.
  lineId: string
  artworkSlug: string
  artworkId: string
  providerId: ProviderId
  editionType: 'open' | 'limited'
  variantId?: string // limited only
  config: WizardConfig
  quantity: number
  // Display snapshot captured at add time (re-validated server-side at checkout).
  unitArtistCents: number
  unitProductionCents: number
  unitGalleryCents: number
  thumbnailUrl: string
  title: string
  artistName: string
}

export type CartItemTotals = {
  unitItemCents: number // artist + production + gallery, per unit (pre-shipping, pre-VAT)
  lineItemCents: number // unitItemCents × quantity
}
```

- [ ] **Step 2.2: Write failing test** `e2e/cart-math.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { lineTotal, cartSubtotal } from '@/lib/cart/cartMath'

test('lineTotal multiplies unit item price by quantity', () => {
  const item = {
    unitArtistCents: 1000,
    unitProductionCents: 500,
    unitGalleryCents: 675,
    quantity: 2,
  }
  expect(lineTotal(item as any).lineItemCents).toBe((1000 + 500 + 675) * 2)
})

test('cartSubtotal sums line totals, excludes shipping and VAT', () => {
  const items = [
    { unitArtistCents: 1000, unitProductionCents: 500, unitGalleryCents: 675, quantity: 2 },
    { unitArtistCents: 2000, unitProductionCents: 800, unitGalleryCents: 1260, quantity: 1 },
  ]
  expect(cartSubtotal(items as any)).toBe(2175 * 2 + 4060)
})
```

- [ ] **Step 2.3: Run, verify fail** — `pnpm test:e2e cart-math` → FAIL (module not found).

- [ ] **Step 2.4: Implement** `src/lib/cart/cartMath.ts`:

```ts
import type { CartItem, CartItemTotals } from './types'

export function lineTotal(
  item: Pick<CartItem, 'unitArtistCents' | 'unitProductionCents' | 'unitGalleryCents' | 'quantity'>,
): CartItemTotals {
  const unitItemCents = item.unitArtistCents + item.unitProductionCents + item.unitGalleryCents
  return { unitItemCents, lineItemCents: unitItemCents * item.quantity }
}

export function cartSubtotal(items: Array<Parameters<typeof lineTotal>[0]>): number {
  return items.reduce((sum, i) => sum + lineTotal(i).lineItemCents, 0)
}
```

- [ ] **Step 2.5: Run, verify pass.** `pnpm test:e2e cart-math` → PASS. Then `pnpm typecheck`.

- [ ] **Step 2.6: Commit** `feat(AR-129): cart domain types + money helpers`.

---

## Task 3: Cart client store (localStorage) + header cart icon

**Files:**

- Create: `src/lib/cart/useCart.ts` (client hook + provider)
- Modify: `src/components/ui/Header/Header.tsx` + `Header.module.scss`
- Create: `src/components/cart/CartIcon/CartIcon.tsx` + module.scss

- [ ] **Step 3.1: Implement `useCart`** — React context + `localStorage` persistence under key `the-art-room:cart`. API: `items`, `addItem(item)`, `removeItem(lineId)`, `setQuantity(lineId, qty)`, `clear()`, `count` (sum of quantities). Hydrate from localStorage on mount; write through on every mutation; guard `try/catch` around storage. Selections only — never store prices as the source of truth (re-validated server-side). Mount the provider in the public layout (`src/app/layout.tsx` or the public segment layout — match where the existing providers mount).

- [ ] **Step 3.2: CartIcon** — `<Link href="/cart">` with a count badge from `useCart().count`; squared styling; uses `<Button />`/icon conventions. Hidden (or count 0) when empty per existing header patterns.

- [ ] **Step 3.3: Wire into Header** — add `<CartIcon />` to `Header.tsx` in the nav slot.

- [ ] **Step 3.4: Verify** `pnpm typecheck && pnpm lint`. Manual: add via console/test that count persists across reload.

- [ ] **Step 3.5: Commit** `feat(AR-129): cart store + header cart icon`.

---

## Task 4: Wizard terminal CTA → add-to-cart

**Files:**

- Modify: `src/components/PrintWizard/SummaryPanel.tsx`
- Modify: `src/components/PrintWizard/index.tsx`, `LimitedWizard.tsx` (pass artwork/variant context to SummaryPanel)

- [ ] **Step 4.1: Remove shipping/VAT from SummaryPanel.** The wizard summary shows item price only (artwork/config price). Delete the "Shipping to:", shipping, and VAT rows from the wizard summary (they move to checkout). Keep the per-config item price so buyers can compare options.

- [ ] **Step 4.2: Replace terminal CTA.** Change the disabled "Add shipping address" `<Button size="bigSquared">` to an enabled **"Add to cart"** that calls `useCart().addItem(...)` building a `CartItem` from the current wizard config (+ `variantId` for limited). After add, show two CTAs: **"Continue Shopping"** (close/return) and **"Go to cart"** (`/cart`).

- [ ] **Step 4.3: Limited guard.** For limited editions, "Add to cart" triggers the reservation call from Task 6 (until Task 6 lands, addItem is client-only). Leave a typed seam: `addItem` returns a promise so Task 6 can await the server hold.

- [ ] **Step 4.4: Verify** `pnpm typecheck && pnpm lint`. No WebGL e2e.

- [ ] **Step 4.5: Commit** `feat(AR-129): wizard add-to-cart CTA, item-price-only summary`.

---

## Task 5: Cart page

**Files:**

- Create: `src/app/cart/page.tsx` + `src/components/cart/CartPage/CartPage.tsx` + module.scss
- Create: `src/components/cart/CartLine/CartLine.tsx` + module.scss

- [ ] **Step 5.1: CartPage** — reads `useCart()`; renders one `CartLine` per item; running subtotal via `cartSubtotal`; empty state; CTA **"Continue to checkout"** → `/checkout` (Task 7). Item prices only; no shipping/VAT.

- [ ] **Step 5.2: CartLine** — thumbnail (aspect-ratio-respecting, height-capped — reuse the InquireSidebar pattern), title/artist, specs (height × width cm), unit price, quantity stepper, remove. For limited items the stepper max is the remaining-available cap (Task 6 supplies it; until then cap at current quantity).

- [ ] **Step 5.3: Verify** `pnpm typecheck && pnpm lint`; manual render.

- [ ] **Step 5.4: Commit** `feat(AR-129): cart page + line items`.

---

## Task 6: Cart-time reservation + TTL sweep + countdown (limited)

**Files:**

- Create: `src/lib/editions/reserveForCart.ts`
- Create: `src/lib/editions/sweepExpiredReservations.ts`
- Create: `src/app/api/cart/reserve/route.ts` (POST: reserve N for a variant; returns held numberIds + `expiresAt`)
- Create: `src/app/api/cart/release/route.ts` (POST: release on remove)
- Modify: `src/lib/cart/useCart.ts` (await reserve on add for limited; release on remove)
- Create: `src/components/cart/HoldCountdown/HoldCountdown.tsx`
- Test: `e2e/cart-reservation.spec.ts`

- [ ] **Step 6.1: Reservation TTL constant + sweep.** Add `RESERVATION_TTL_MS = 12 * 60 * 1000` in `src/lib/editions/reserveForCart.ts`. `sweepExpiredReservations()` sets `state='available'`, clears `paymentIntentId`/`orderItemId`/`reservedAt`/`buyerEmail` for rows where `state='reserved' AND orderItemId IS NULL AND reservedAt < now() - TTL`. Never sweeps `sold` or order-bound rows. Call the sweep lazily at the top of `reserveForCart` and `reserve` route (lazy-on-read) so no cron is required for v1; note a cron can be added later.

- [ ] **Step 6.2: `reserveForCart({ variantId, quantity, buyerEmail? })`.** Loops `reserveNextEditionNumber` (existing, atomic) `quantity` times; if any iteration returns `sold_out`, release the ones already claimed this call (via `releaseEditionNumberById`) and return `{ ok:false, reason:'insufficient_stock', available:<n> }`. On success return `{ ok:true, numberIds, expiresAt: Date.now()+TTL }`. buyerEmail may be unknown at cart time — pass a placeholder/empty and fill at checkout; keep the column nullable.

- [ ] **Step 6.3: Routes.** `POST /api/cart/reserve` validates variant published+blocked, runs sweep, calls `reserveForCart`, returns held numberIds + `expiresAt`. `POST /api/cart/release` releases given numberIds (only if not order-bound). Both rate-limited/guarded like existing routes.

- [ ] **Step 6.4: Wire `useCart`.** For limited `addItem`, await `/api/cart/reserve`; store `numberIds` + `expiresAt` on the cart line; cap quantity at returned availability; on `removeItem`/quantity-decrease, call `/api/cart/release` for the freed numbers. Open editions skip all of this.

- [ ] **Step 6.5: HoldCountdown** — client component counting down to `expiresAt` (server-provided); shows "You have M:SS left to complete this order"; on hit-zero, marks the line expired and prompts re-add. UI only — the server clock is authority.

- [ ] **Step 6.6: e2e** `e2e/cart-reservation.spec.ts` (API-level, no WebGL): seed a variant with editionSize small; reserve quantity up to cap succeeds; reserving over cap returns `insufficient_stock`; a reservation older than TTL is swept back to available on next read; two concurrent reserves of the last number → exactly one wins.

- [ ] **Step 6.7: Run e2e** → PASS. `pnpm typecheck && pnpm lint`.

- [ ] **Step 6.8: Commit** `feat(AR-129): cart-time edition holds, TTL sweep, countdown`.

---

## Task 7: Checkout — address form + per-item re-validation + flat shipping + VAT

**Files:**

- Create: `src/app/checkout/page.tsx` + `src/components/checkout/CartCheckout/CartCheckout.tsx`
- Create: `src/components/checkout/AddressForm/AddressForm.tsx` (extract from existing PrintCheckout if reusable)
- Create: `src/lib/cart/validateCart.ts` (server)
- Modify: `src/lib/print-providers/printspace/pricing.ts` (flat shipping per destination helper if not present)

- [ ] **Step 7.1: AddressForm** — name, email, shipping address, country. Squared controls; validation flow per project rule (silent on arrival → all errors on submit → clear live as fixed). First and only place the address is collected.

- [ ] **Step 7.2: `validateCart(items, address)` server action** — for EACH item re-checks: artwork print-enabled, per-artwork restrictions (`findConfigRestrictionClash`), `configShipsTo(country)`, and re-quotes server-side (`getProviderQuote`). Returns per-item `{ ok, reason? }` + recomputed per-item money. Reuses the exact guards from `createPaymentIntent.ts`, looped. Any failure → return the offending lineIds; caller returns buyer to cart with a specific message; no PI.

- [ ] **Step 7.3: Flat shipping + VAT.** Shipping = one flat fee for the destination country (TPS confirmed flat per shipment), independent of item count — a single `flatShippingCents(country)` lookup. VAT via existing `getVatRate` applied to the order taxable base. Compute order totals server-side; client shows them read-only.

- [ ] **Step 7.4: CartCheckout** — renders items + quantities, flat shipping, VAT, final total, "change address" link → Stripe step (Task 8).

- [ ] **Step 7.5: Verify** `pnpm typecheck && pnpm lint`.

- [ ] **Step 7.6: Commit** `feat(AR-129): cart checkout, address-at-end, per-item revalidation, flat shipping`.

---

## Task 8: Pending cart + one PaymentIntent for the cart

**Files:**

- Modify: `prisma/schema.prisma` — add `PendingCart` (USER runs db push)
- Create: `src/lib/cart/pendingCart.ts`
- Create: `src/components/checkout/CartCheckout/createCartPaymentIntent.ts` (server action)

- [ ] **Step 8.1: `PendingCart` model** (schema; user pushes):

```prisma
model PendingCart {
  id              String   @id @default(uuid())
  paymentIntentId String   @unique
  buyerEmail      String
  buyerName       String
  shippingAddress Json
  country         String
  // Validated line items + computed money, the source the webhook builds from.
  items           Json
  totalCents      Int
  shippingCents   Int
  customerVatCents Int
  currency        String   @default("eur")
  createdAt       DateTime @default(now())
}
```

Run `pnpm db:generate`; HANDOFF db push to user (same rule as Task 1).

- [ ] **Step 8.2: `createCartPaymentIntent(items, address)`** — re-runs `validateCart` (never trust client), computes totals (Task 7), creates ONE Stripe PI `capture_method:'manual'`, `amount = totalCents`, minimal metadata (`kind:'cart'`, no per-item config — too big), `receipt_email`, shipping address. Persists a `PendingCart` row keyed by `paymentIntentId` with the validated items + money. For limited items, attach each held edition number to the PI (`attachPaymentIntentToReservation`). Idempotency hash over (items, address, totalCents). Returns `{ ok, clientSecret, paymentIntentId, totals }`.

- [ ] **Step 8.3: Reuse the existing Stripe Elements payment step** (`PrintPayment`) pointed at the cart client secret; on success show confirmation.

- [ ] **Step 8.4: Verify** `pnpm typecheck && pnpm lint`.

- [ ] **Step 8.5: Commit** `feat(AR-129): pending cart + single cart PaymentIntent`.

---

## Task 9: Webhook → create header + line items; bind edition numbers

**Files:**

- Create: `src/lib/orders/createPrintOrderFromCart.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`
- Modify: `src/lib/orders/createPrintOrderFromPaymentIntent.ts` (route by metadata.kind)

- [ ] **Step 9.1: `createPrintOrderFromCart(paymentIntent)`** — loads the `PendingCart` by PI id; if missing, log an error event + admin alert and DO NOT create a partial order. In one transaction: create `PrintOrder` (header: buyer, address, country, `totalCents`, `customerVatCents`, `productionShippingCents`, `paymentStatus:'authorized'`); create N `PrintOrderItem` rows (per-item money, quantity, config); for each limited item, `bindEditionNumberToOrder`-equivalent now binding to `orderItemId` (extend the bind helper or add `bindEditionNumbersToOrderItem(paymentIntentId, orderItemId, ...)`). Delete the `PendingCart` row. Emit `PrintOrderEvent`s.

- [ ] **Step 9.2: Route in webhook.** On `payment_intent.amount_capturable_updated`, if `metadata.kind === 'cart'` → `createPrintOrderFromCart`; else existing single-print path (kept for back-compat during rollout). `succeeded` → header `paymentStatus='succeeded'`. `canceled`/`payment_failed` → release ALL reserved edition numbers for the PI + delete the `PendingCart`.

- [ ] **Step 9.3: Bind helper update.** Edition numbers now bind to `orderItemId` not `orderId`. Update `bindEditionNumberToOrder` (and `releaseEditionNumberForPaymentIntent`, `markEditionNumberSold` — these key on `paymentIntentId` so they keep working) to write `orderItemId`.

- [ ] **Step 9.4: e2e** extend the Stripe-isolation pattern: seed a 2-item cart (one open, one limited), create PI, simulate auth, assert one `PrintOrder` with two `PrintOrderItem`s and the limited item's `EditionNumber` bound to its `orderItemId`.

- [ ] **Step 9.5: Verify** e2e PASS, `pnpm typecheck && pnpm lint`.

- [ ] **Step 9.6: Commit** `feat(AR-129): webhook builds order header + line items from pending cart`.

---

## Task 10: Admin — multi-item detail, per-item payouts, payouts page, ledger relink

**Files:**

- Modify: `src/app/admin/orders/actions.ts`
- Modify: `src/components/admin/orders/OrderDetail.tsx`, `index.tsx`
- Modify: `src/components/admin/edition-sales/index.tsx`
- Modify: payouts page + actions

- [ ] **Step 10.1: `listOrders`** — aggregate over items: item count, summed totals; keep status columns.

- [ ] **Step 10.2: `getOrderDetail`** — return header + `items[]` (artwork, specs via printConfig, qty, per-item money, per-item transfer status). Specs summary computed per item.

- [ ] **Step 10.3: Per-item payout.** `createTransfer` becomes per `PrintOrderItem` (Stripe Connect transfer to that item's artist). An order can be partly paid out. `markPlaced` (capture) + fulfillment stay order-level.

- [ ] **Step 10.4: Payouts page** — one row per item transfer (was per order).

- [ ] **Step 10.5: Edition-sales ledger** — read through `EditionNumber → orderItem → order`; preserve all columns (buyer email/name, number/editionSize, state, date, mirrored flag). `quantity=2` shows two numbered rows.

- [ ] **Step 10.6: Verify** `pnpm typecheck && pnpm lint`; manual admin walkthrough.

- [ ] **Step 10.7: Commit** `feat(AR-129): admin multi-item orders + per-item payouts + ledger relink`.

---

## Task 11: Whole-order refund + e2e

**Files:**

- Modify: admin order actions (refund)
- Test: `e2e/cart-checkout.spec.ts`

- [ ] **Step 11.1: Whole-order refund.** Reverse the PI; for each item with a transfer, reverse/cancel as applicable; set header `paymentStatus='refunded'`; release any still-reserved edition numbers; emit events. Per-item refund explicitly out of scope.

- [ ] **Step 11.2: e2e happy path** `e2e/cart-checkout.spec.ts` (Stripe-isolation, no WebGL): build a 2-item cart via seeded state, deep-link to checkout, submit address, create PI (test card), assert PI authorized + PendingCart persisted; simulate capture; assert order captured. Declined card → no order, holds released.

- [ ] **Step 11.3: Run full e2e** → PASS. `pnpm typecheck && pnpm lint`. Local prod build (`pnpm build && pnpm start -p 3001`) for the route/import-graph changes.

- [ ] **Step 11.4: Commit** `feat(AR-129): whole-order refund + multi-item checkout e2e`.

---

## Verification summary (definition of done)

- A buyer can add multiple prints (mixed artists, quantities) to a cart, check out once, pay once, and the order ships as one parcel with one flat shipping fee.
- Address is collected only at checkout; shipping/VAT/totals shown only there.
- Limited editions: quantity capped at remaining; add-to-cart holds the number(s) server-side with a TTL sweep; buyer sees a countdown; no edition number can ever be sold twice (the `@@unique([variantId, number])` gate is untouched).
- Admin order detail shows N line items; payouts are per-item; the edition-sales ledger is intact through the relink.
- Whole-order refund works; per-item refund deferred.
- All e2e green; typecheck + lint + local prod build clean.
- Schema pushes were run by the USER, not from here.

## Rollout

- Single-print path kept alongside the cart path during the branch (webhook routes by `metadata.kind`) so nothing breaks mid-migration. Header scalar-field removals (Task 1.3) apply to dev/staging only until AR-129 is the live branch; prod `main` still reads the old shape until release. Final prod DB sync (schema push) is run by the user with the release (per the Vercel-doesn't-migrate rule).
