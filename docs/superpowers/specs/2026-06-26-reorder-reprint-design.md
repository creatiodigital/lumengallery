# Re-order / replacement reprint (damaged, wrong size, bad print)

**Date:** 2026-06-26
**Branch:** `feat/AR-130-shoping-cart-refinement`
**Status:** Approved (Eduardo, 2026-06-26)
**Context:** The faulty-goods carve-out from [[project_capture_tps_money_flow]] — a
defective/damaged print is ALWAYS remedied, even after delivery. When the buyer (or TPS)
chooses **reprint & resend** rather than a refund, the dashboard has no way to model the
replacement. This adds a "Re-order" action that re-runs the existing fulfillment pipeline
for the same order, plus a permanent visible flag. Rides on the capture/place split
(spec 2026-06-24-capture-place-split-design.md).

## Design

### The action — `reorderForReprint(orderId, { reason, note })`

Resets the order to **step ② "To place at TPS"** so the replacement walks the normal
pipeline again, WITHOUT re-charging:

- **Guards:** `paymentStatus === 'succeeded'` (already captured), NOT refunded/canceled,
  and `fulfillmentStatus ∈ { 'Started', 'Shipped', 'Complete' }` (a print actually
  exists to be a replacement of). `reason` required.
- **Resets:** `fulfillmentStatus → null` (so it lands in the **To place at TPS** queue),
  `trackingUrl → null`, `shippedAt → null` (fresh shipment for the new copy).
- **Does NOT touch:** `paymentStatus` (stays `succeeded`) → so `capturePayment` (which
  requires `authorized`) is impossible and there is **no double-charge**; the order shows
  **Mark placed at TPS**, not Capture. Edition number stays **sold** (same numbered copy
  remade — no ledger change). Payout (`paidOutAt`/transfers) untouched (the sale stands).
- **Records:** `reorderCount += 1`, `reorderReason = reason`, `reorderNote = note ?? null`,
  `reorderedAt = now()`. Logs a `reorder` event (`Replacement reprint — <reason>: <note>`)
  so the timeline keeps every reset with its reason + date.

No buyer email is added here; the existing forward-stage emails (in production / shipped /
delivered) re-fire as the replacement advances. (Replacement-aware copy = future polish.)

### Soft cap (Eduardo's call)

**No server block.** The first two reprints are frictionless; from the **3rd** on
(`reorderCount >= 2`) the UI confirm-modal shows a warning — _"This order has already been
reprinted twice — a refund may serve the buyer better."_ — and still lets the admin
proceed. **Refund** is always available as the alternative.

### Always-visible flag

A permanent badge wherever the order appears (survives re-delivery):

- **Orders list row:** `⟳ Replacement` chip when `reorderCount > 0`.
- **Order detail header:** `⟳ Reset — <reason> · "<note>" · <date> (×N)`.
- **Timeline:** one `reorder` event per reset → full reason history.

### Schema (PrintOrder) — additive, Eduardo pushes the migration

```
reorderReason String?    // 'damaged' | 'wrong_size' | 'print_quality' | 'other'
reorderNote   String?
reorderedAt   DateTime?
reorderCount  Int        @default(0)
```

`@default(0)` + nullable = safe additive change against prod. Per house rules Claude edits
`schema.prisma`; Eduardo runs the DB push + `pnpm db:generate`.

### UI

- **OrderDetail:** a **"Re-order (reprint)"** action — deliberately set apart from the
  forward CTA (it's a sanctioned _backward_ move), opening a modal: reason dropdown
  (damaged / wrong size / print quality / other) + optional note + (when `reorderCount >= 2`)
  the soft-cap warning. On confirm → `reorderForReprint`. Plus the `⟳ Reset — …` badge in
  the header.
- **Orders list:** the `⟳ Replacement` chip on rows with `reorderCount > 0`; `listOrders`
  - `AdminOrderRow` gain `reorderCount` + `reorderReason`.

## Testing (TDD, UI-driven, email-bypassed, self-cleaning)

New `e2e/order-reorder.spec.ts`:

1. **Reset:** buy → capture → place → mark through to Complete → Re-order (reason
   'damaged') → assert `fulfillmentStatus === null`, `paymentStatus === 'succeeded'`,
   `reorderCount === 1`, `reorderReason === 'damaged'`, `trackingUrl`/`shippedAt` cleared,
   edition number still `sold`, order now in the **To place at TPS** queue.
2. **No re-capture path:** the re-ordered order shows **Mark placed at TPS**, not Capture.
3. **Soft cap:** after 2 reorders, opening the Re-order modal a 3rd time shows the warning
   text (still allowed).
4. **Badge:** the orders list shows `⟳ Replacement` for the re-ordered order.
5. **Guard:** Re-order is unavailable / refused on a refunded order and on a never-placed
   order.

## Out of scope (future)

- Replacement-aware buyer email copy ("your replacement is on its way").
- Linked child-order accounting (we deliberately reset the same order — simpler for a
  solo operator; the event log preserves the story).
- A reprint-cost split if TPS ever bills the gallery for a reprint (today TPS covers
  their-fault reprints).
  </content>
