# Split "Capture & place" into ① Capture payment → ② Mark placed at TPS

**Date:** 2026-06-24
**Branch:** `feat/AR-130-shoping-cart-refinement`
**Status:** Approved (Eduardo, 2026-06-24)
**Context:** Money-safety flow decided in `memory/project_capture_tps_money_flow.md`.
TPS charges immediately at placement (no account billing) and only allows
cancellation within ~1h, so the gallery MUST capture the buyer **before** paying
TPS. Today the dashboard does the opposite.

## Problem

`markPlaced` ([actions.ts:1513]) does **capture + mark-placed in one click**
(`stripe.paymentIntents.capture` → `fulfillmentStatus='Placed'`,
`paymentStatus='succeeded'`, edition→sold), and the New-tab instruction reads
_"Place the order on theprintspace, then click Capture & mark placed."_ That nudges
the **dangerous order**: pay TPS first, then capture — if the capture then fails
(dead/expired card), the gallery is out the TPS print cost (e.g. €2k) with no buyer
money. We need **capture-first** to be the only path, and the dashboard to show one
obvious next step per order.

## Design

Split the single action into two explicit, ordered server actions. **No buyer email
fires at either step today** (the first fulfillment email is at "In production" /
`markStarted`), so this is a purely internal/operational change — buyers see no
difference.

### Two server actions (replacing `markPlaced`)

**`capturePayment(orderId)`**

- Guards: `paymentStatus === 'authorized'` AND `fulfillmentStatus === null` (PENDING)
  AND payment not refunded/canceled.
- Captures the PI. On Stripe failure → `captureError` + clear message; **order stays
  put, fully recoverable** (this is the safety gate — if capture fails you never go to
  TPS).
- On success: `paymentStatus='succeeded'`, `fulfillmentStatus` stays `null`. Marks the
  edition number **sold** (money collected = sale final), logs `edition_sold` +
  `admin_action` ("Payment captured").

**`markPlacedAtTps(orderId)`**

- Guards: `paymentStatus === 'succeeded'` AND `fulfillmentStatus === null` AND not
  refunded/canceled. (So it is impossible to place before capturing.)
- Sets `fulfillmentStatus='Placed'`. No capture, no edition-sold (already done at
  capture). Logs `admin_action` ("Marked placed at The Print Space").

### State modeling — reuse existing fields (no migration)

The "captured but not yet placed" state is **derived**, not a new enum value:

| paymentStatus | fulfillmentStatus | Meaning                            | Tab                 | Next action            |
| ------------- | ----------------- | ---------------------------------- | ------------------- | ---------------------- |
| `authorized`  | `null`            | bought, card on hold, not captured | **New**             | **Capture payment**    |
| `succeeded`   | `null`            | captured, not yet placed at TPS    | **To place at TPS** | **Mark placed at TPS** |
| `succeeded`   | `Placed`          | placed at TPS                      | **At TPS**          | Mark in production     |
| `succeeded`   | `Started`/…       | unchanged                          | In production / …   | …                      |

No `schema.prisma` change, nothing to db-push, zero risk on the shared DB. Cost: the
intermediate state is implicit in `(paymentStatus, fulfillmentStatus)` — documented
here and in a shared helper so the list, detail page, and guards all read it the same
way.

### UI changes

- **Orders list ([components/admin/orders/index.tsx]):** add a **"To place at TPS"**
  tab between **New** and **At TPS**, filtering `paymentStatus='succeeded' &&
fulfillmentStatus=null`. The **New** tab now filters `paymentStatus='authorized' &&
fulfillmentStatus=null` (captured orders leave New for the new tab). Per-row CTA: New
  → "Capture payment"; To place at TPS → "Mark placed at TPS".
- **Order detail ([components/admin/orders/OrderDetail.tsx]):** replace the single
  "Capture & place" button with **① Capture payment** (shown when authorized+pending)
  then **② Mark placed at TPS** (shown when succeeded+pending). Reword the helper text
  to the safe order: _"Capture the payment first; once it succeeds, place + pay the
  order at theprintspace, then mark it placed."_
- Refunded/canceled orders stay terminal & read-only — both new actions refuse on
  those payment statuses, same as the existing `advanceStage`/`cancelOrder` guards.

### What stays the same

- `markStarted` (In production), `markShipped`, `markDelivered`, payout gate, refund,
  cancel, delete — all unchanged.
- Edition-number lifecycle (reserve→sold→release) — sold still happens at capture, just
  now in `capturePayment` instead of the combined action.
- No buyer emails added or moved.

## Testing (TDD, e2e — drive the real path)

New/updated specs (email-bypassed, self-cleaning per
`memory/feedback_e2e_no_dashboard_noise.md`):

1. **Capture path:** authorized order → `capturePayment` → assert PI captured
   (`succeeded`), edition `sold`, fulfillment still `null`, order now in "To place at
   TPS" set.
2. **Place path:** captured order → `markPlacedAtTps` → assert `fulfillmentStatus='Placed'`.
3. **Ordering is enforced:** `markPlacedAtTps` on an `authorized` (un-captured) order →
   refused (can't place before capture). `capturePayment` on an already-captured order
   → refused.
4. **Capture failure:** force a non-capturable PI (e.g. canceled) → `capturePayment`
   returns a clear error, order stays New, edition NOT sold.
5. **Terminal read-only:** both actions refuse on refunded/canceled.
6. Update any existing spec that called `markPlaced` (e.g. lifecycle) to the two-step
   flow.

## Out of scope (separate follow-ups)

- **Hold-expiry warning** on New orders (capture within ~7 days or the hold lapses) —
  valuable, but its own change; tracked in `memory/project_capture_tps_money_flow.md`.
- **Online Terms of Sale** edits (§5 capture wording etc.) — content change, separate.
- Renaming the existing "At TPS" tab (kept as-is to avoid churn; "To place at TPS" vs
  "At TPS" are distinct enough with their row CTAs).
  </content>
