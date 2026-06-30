# Layer-3 reconcile cron — auto-recover orders + release orphaned reservations

**Date:** 2026-06-24
**Branch:** `feat/AR-130-shoping-cart-refinement`
**Status:** Approved (Eduardo, 2026-06-24)
**Context:** Final layer of the guaranteed-order-capture launch blocker. See
`memory/project_guaranteed_order_capture.md` (Layer 3). Layers 1 (synchronous
`ensureOrderForPaymentIntent` at confirmation), 2 (webhook backup), and 4 (Stripe
PI summary) are shipped in `cb76db4`. This hardens the existing alert-only cron.

## Problem

The cron at `src/app/api/cron/reconcile-orders/route.ts` is **alert-only**: it lists
recent Stripe PaymentIntents that should have a `PrintOrder` but don't, and emails
the admin to recover them by hand. Two gaps remain:

1. **No auto-recovery.** Layer 1 made `ensureOrderForPaymentIntent` idempotent and
   reusable, but the cron still only alerts. It should *create the missing order
   itself*.
2. **Orphaned-reservation leak.** A limited edition number is reserved at PI
   creation (`state='reserved'`, `paymentIntentId` set, no `orderId`/`orderItemId`).
   If the webhook never fires (and the buyer never reaches the confirmation page that
   would call Layer 1), the number is never bound to an order **nor released**:
   - The cart-hold TTL sweep (`sweepExpiredCartHolds`) explicitly skips rows with a
     `paymentIntentId`, so it can't reclaim it.
   - The normal release path (`releaseEditionNumberForPaymentIntent`) only runs from
     the Stripe `payment_intent.canceled`/`payment_failed` webhook — which is exactly
     what's down.
   → The number is stuck `reserved` forever with no buyer/order. Observed 2026-06-24:
   5 stuck Landscape&River reservations from failed morning buys.

## Design

Two phases inside the existing `GET` handler, run in order.

### Discovered during implementation (2026-06-24)

- **Cart-orphan blind spot (fix, not new feature).** The existing Phase A filter is
  `if (!pi.metadata?.wizardConfig) return false`. Single-print PIs carry
  `metadata.wizardConfig`; **cart PIs carry `metadata.kind='cart'` and NO
  `wizardConfig`** (`createCartPaymentIntent` line 170). So the cron today silently
  ignores every cart orphan — and cart is the primary flow. Broaden the "is this
  ours" predicate to `pi.metadata?.wizardConfig || pi.metadata?.kind === 'cart'`.
- **`?minAgeMinutes=` override (auth-gated test/ops hook).** The 30-min min-age guard
  keys off the Stripe `created` timestamp, which a test can't backdate. The route
  accepts an optional `minAgeMinutes` query param (default 30) so an authorized caller
  can run an immediate reconcile. Behind the same `Bearer CRON_SECRET` gate; the
  Vercel cron hits the path with no param → 30-min default unchanged. Tests pass
  `?minAgeMinutes=0`. (Phase B's cutoff uses the DB `reservedAt`, which tests backdate
  directly, so it needs no override.) **Parsing guard:** `searchParams.get` returns
  `null` when absent and `Number(null) === 0` (not `NaN`) — so the route must check
  for `null` BEFORE `Number()`, else the 30-min default never applies and prod acts on
  seconds-old PIs. (The in-flight e2e caught exactly this.)

### Phase A — recover orphan orders (authorized PI, no order row)

Keep the current Stripe-list scan (last 24h, "ours" = `wizardConfig` OR `kind='cart'`,
status in `requires_capture`/`succeeded`/`processing`, older than the min-age).
For each orphan PI with no `PrintOrder`:

- Call `ensureOrderForPaymentIntent(pi.id)` — the same idempotent builder the
  confirmation page uses. It dispatches cart vs single-print and **binds the reserved
  edition number to the new order** as a side effect.
- Tally `recovered` (created) vs `recoveryFailed` (returned `ok:false`).

`processing` PIs aren't yet authorized, so `ensureOrder` will return `ok:false` for
them by design; they count as "still pending", not a hard failure — track separately
so the alert doesn't cry wolf on a PI that's a few minutes from authorizing.

### Phase B — release orphan reservations (dead PI, stuck `reserved`)

Phase A binds authorized PIs' numbers, so by the time Phase B runs only genuinely
dead reservations remain. Query the DB directly (these PIs are *canceled* and so are
filtered out of Phase A's authorized-only list):

```sql
EditionNumber
WHERE state = 'reserved'
  AND paymentIntentId IS NOT NULL        -- past the cart-hold sweep's reach
  AND orderId IS NULL AND orderItemId IS NULL  -- never bound to an order
  AND reservedAt < now() - interval '30 minutes'  -- let in-flight checkouts finish
```

For each **distinct** `paymentIntentId`, retrieve the PI from Stripe and branch on
status:

| PI status | Action | Why |
|---|---|---|
| `requires_capture`, `succeeded` | **leave** | Phase A created+bound its order this run |
| `canceled`, `requires_payment_method`, `requires_confirmation` | **release** via `releaseEditionNumberForPaymentIntent(piId)` | abandoned/dead — number returns to pool |
| `processing`, `requires_action` | **leave** | genuinely in-flight |
| **PI not retrievable** (deleted / unknown id / Stripe error) | **leave + alert** | never auto-release on incomplete info (Eduardo, 2026-06-24) |

Tally `reservationsReleased` and `reservationsUnresolvedPI` (the not-retrievable set).

### Alerting (Eduardo's calls, 2026-06-24)

- **Always alert on auto-recovery.** Any recovery means the webhook path is broken —
  that's signal we need before/at launch. The critical alert fires whenever
  `recovered > 0` OR `recoveryFailed > 0` OR `reservationsReleased > 0` OR
  `reservationsUnresolvedPI > 0`, and states plainly what was auto-fixed vs what still
  needs a human. A clean run (all zero) sends nothing.
- **PI-not-found → leave + alert**, never auto-release.

### Response shape

```json
{
  "checked": <int>,                    // orphan-candidate PIs scanned (Phase A)
  "recovered": <int>,                  // orders created this run
  "recoveryFailed": <int>,             // ensureOrder returned ok:false (authorized but build failed)
  "stillPending": <int>,               // processing PIs not yet authorized
  "reservationsScanned": <int>,        // distinct stuck-reservation PIs (Phase B)
  "reservationsReleased": <int>,
  "reservationsUnresolvedPI": <int>
}
```

### What stays the same

- Auth (`Authorization: Bearer <CRON_SECRET>`, 401 otherwise; 500 if unset).
- 24h Stripe lookback, 30-min min-age, single-page 100-PI list (paginate later if
  volume demands).
- Schedule `0 9 * * *` in `vercel.json` (daily = Hobby-plan ceiling). Bumping cadence
  is an ops decision on plan upgrade, not part of this change.
- `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.

## Components

- **`src/app/api/cron/reconcile-orders/route.ts`** — orchestrates Phase A + B, builds
  the consolidated alert, returns the new JSON. The only route touched.
- **New helper `src/lib/editions/findOrphanedReservations.ts`** — the Phase B DB query
  (lives with the other edition-ledger helpers it's kin to), returning distinct stuck
  `{ paymentIntentId, numberIds }`. Keeps the route thin and the query coverable.
- **Reused, unchanged:** `ensureOrderForPaymentIntent`,
  `releaseEditionNumberForPaymentIntent`, `sendAdminCriticalAlert`, `captureError`.

## Testing (TDD, R3 — drive the real path, fail when it breaks)

New `e2e/order-reconcile.spec.ts` on the real route, email-bypassed
(`SKIP_EMAILS=true` on the runner — see `memory/feedback_no_emails_in_e2e.md`), built
on the headless money-path helpers in `order-helpers.ts`:

1. **Recovery:** authorize a limited PI, assert no order yet → POST the cron (with
   `Bearer CRON_SECRET`) → assert a `PrintOrder` now exists and the edition number is
   `reserved` and bound (`orderId`/`orderItemId` set).
2. **Idempotent recovery:** run the cron twice → exactly one order, no duplicate.
3. **Reservation release:** reserve a number + attach a PI, cancel the PI in Stripe,
   backdate `reservedAt` past the 30-min cutoff → POST the cron → assert the number is
   back to `available` with `paymentIntentId=null`.
4. **In-flight is left alone:** a fresh reserved+PI row (within the cutoff, PI still
   `requires_capture`) → POST the cron → number unchanged.
5. **Auth:** no/invalid Bearer → 401, no DB mutation.

No test asserts email content (bypassed); assert the JSON response counts instead.

## Out of scope

- Cron cadence change (ops/plan decision).
- Per-env Stripe Dashboard webhook endpoint/secret config (separate launch to-do).
- Single-print `createPaymentIntent.ts` Stripe-summary (Layer 4 single-print remainder
  tracked in `project_guaranteed_order_capture.md`).
</content>
</invoke>
