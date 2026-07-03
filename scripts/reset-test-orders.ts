/**
 * Reset ALL test orders + free the limited-edition series. DEV/TEST ONLY.
 *
 * ⚠️ Local dev and staging SHARE this database — running --confirm wipes
 * orders on BOTH. Stripe is untouched (test mode; irrelevant per request).
 *
 * Thin CLI over the shared implementation in src/lib/admin/resetTestData.ts
 * (also behind the admin dashboard's "Dev cleanup" button). What --confirm
 * does, in order:
 *   1. Resets every reserved/sold EditionNumber back to `available` and
 *      backfills hard-deleted slots, so each edition is a clean 1..N again
 *      (the next sale gets 1/N, not 3/N). Idempotent.
 *   2. Deletes every Invoice (+ its private R2 PDF) + InvoiceCounter — the
 *      Invoice→PrintOrder FK is onDelete: Restrict, so invoiced test orders
 *      would otherwise abort the reset. Numbering restarts from 001.
 *   3. Deletes every PrintOrder (cascades items + events) and PendingCart.
 *
 * Dry run (safe — only counts):
 *   npx dotenv -e .env.local -- npx tsx scripts/reset-test-orders.ts
 * Execute:
 *   npx dotenv -e .env.local -- npx tsx scripts/reset-test-orders.ts --confirm
 */
import { countTestData, devCleanupAllowed, resetTestData } from '@/lib/admin/resetTestData'
import prisma from '@/lib/prisma'

const CONFIRM = process.argv.includes('--confirm')

async function main() {
  if (!devCleanupAllowed()) {
    console.error('❌ Refusing to run: NEXT_PUBLIC_APP_ENV=production.')
    process.exit(1)
  }

  const dbHost = (process.env.POSTGRES_PRISMA_URL ?? '').match(/@([^/:]+)/)?.[1] ?? '(unknown)'
  const counts = await countTestData()

  console.log('=== RESET TEST ORDERS ===')
  console.log('APP_ENV :', process.env.NEXT_PUBLIC_APP_ENV ?? '(unset)')
  console.log('DB host :', dbHost, '  (NOTE: local + staging share this DB)')
  console.log('Will DELETE →', {
    printOrders: counts.printOrders,
    printOrderItems: counts.printOrderItems,
    printOrderEvents: counts.printOrderEvents,
    pendingCarts: counts.pendingCarts,
    invoices: counts.invoices,
    invoiceCounters: counts.invoiceCounters,
  })
  console.log(
    'Will RESET to available → edition numbers currently reserved/sold:',
    counts.editionNumbersHeld,
  )
  console.log('Will BACKFILL missing slots →', counts.editionSlotsToBackfill)

  if (!CONFIRM) {
    console.log('\nDRY RUN — nothing changed. Re-run with --confirm to execute.')
    return
  }

  const result = await resetTestData()
  console.log('\n✅ DONE:', result)
  console.log('Edition series reset to available + backfilled; all orders + staged carts cleared.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
