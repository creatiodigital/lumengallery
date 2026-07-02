/**
 * Reset ALL test orders + free the limited-edition series. DEV/TEST ONLY.
 *
 * ⚠️ Local dev and staging SHARE this database — running --confirm wipes
 * orders on BOTH. Stripe is untouched (test mode; irrelevant per request).
 *
 * What it does (with --confirm):
 *   1. Resets every reserved/sold EditionNumber back to `available`, clearing
 *      its order/PI/buyer bindings (the state is freed, so the series restarts).
 *   2. Backfills any MISSING slots on every published variant — re-creates the
 *      full 1..editionSize as `available`. This undoes slots that were
 *      hard-deleted in earlier testing, so each edition is a clean 1..N again
 *      (the next sale gets 1/N, not 3/N). Idempotent: a complete series adds
 *      nothing.
 *   3. Deletes every Invoice + InvoiceCounter (and their R2 PDFs) — the
 *      Invoice→PrintOrder FK is onDelete: Restrict, so invoiced test orders
 *      would otherwise abort the whole reset.
 *   4. Deletes every PrintOrder (cascades PrintOrderItem + PrintOrderEvent).
 *   5. Deletes every PendingCart (abandoned staged carts).
 *
 * Dry run (safe — only counts):
 *   npx dotenv -e .env.local -- npx tsx scripts/reset-test-orders.ts
 * Execute:
 *   npx dotenv -e .env.local -- npx tsx scripts/reset-test-orders.ts --confirm
 */
import prisma from '@/lib/prisma'
import { deletePrivateR2Key } from '@/lib/r2'

const CONFIRM = process.argv.includes('--confirm')

async function main() {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    console.error('❌ Refusing to run: NEXT_PUBLIC_APP_ENV=production.')
    process.exit(1)
  }

  const dbHost = (process.env.POSTGRES_PRISMA_URL ?? '').match(/@([^/:]+)/)?.[1] ?? '(unknown)'

  const [orders, items, events, carts, reservedOrSold, publishedVariants, invoiceRows, invoiceCounters] = await Promise.all([
    prisma.printOrder.count(),
    prisma.printOrderItem.count(),
    prisma.printOrderEvent.count(),
    prisma.pendingCart.count(),
    prisma.editionNumber.count({ where: { state: { in: ['reserved', 'sold'] } } }),
    prisma.limitedVariant.findMany({
      where: { published: true },
      select: { id: true, name: true, editionSize: true, editionNumbers: { select: { number: true } } },
    }),
    prisma.invoice.findMany({ select: { r2Key: true } }),
    prisma.invoiceCounter.count(),
  ])

  // Which 1..editionSize slots are MISSING on each published variant (hard-deleted
  // in earlier testing). Re-create them as `available` so the edition is whole.
  const backfill = publishedVariants
    .map((v) => {
      const present = new Set(v.editionNumbers.map((e) => e.number))
      const missing: number[] = []
      for (let n = 1; n <= v.editionSize; n++) if (!present.has(n)) missing.push(n)
      return { id: v.id, name: v.name, missing }
    })
    .filter((b) => b.missing.length > 0)
  const totalBackfill = backfill.reduce((sum, b) => sum + b.missing.length, 0)

  console.log('=== RESET TEST ORDERS ===')
  console.log('APP_ENV :', process.env.NEXT_PUBLIC_APP_ENV ?? '(unset)')
  console.log('DB host :', dbHost, '  (NOTE: local + staging share this DB)')
  console.log('Will DELETE →', { printOrders: orders, printOrderItems: items, printOrderEvents: events, pendingCarts: carts, invoices: invoiceRows.length, invoiceCounters })
  console.log('Will RESET to available → edition numbers currently reserved/sold:', reservedOrSold)
  console.log('Will BACKFILL missing slots →', totalBackfill, totalBackfill ? backfill.map((b) => `${b.name}: +${b.missing.length}`) : '(all editions complete)')

  if (!CONFIRM) {
    console.log('\nDRY RUN — nothing changed. Re-run with --confirm to execute.')
    return
  }

  // Delete invoice PDFs from R2 first (network I/O — kept outside the tx).
  // Test facturas must go with their orders: Invoice.orderId is onDelete:
  // Restrict, so leaving them would abort the printOrder.deleteMany below.
  let invoicePdfsDeleted = 0
  for (const inv of invoiceRows) {
    if (inv.r2Key) {
      try {
        await deletePrivateR2Key(inv.r2Key)
        invoicePdfsDeleted++
      } catch (err) {
        console.warn('R2 invoice PDF delete failed:', err instanceof Error ? err.message : err)
      }
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const reset = await tx.editionNumber.updateMany({
      where: { state: { in: ['reserved', 'sold'] } },
      data: {
        state: 'available',
        paymentIntentId: null,
        orderId: null,
        orderItemId: null,
        buyerEmail: null,
        reservedAt: null,
        soldAt: null,
      },
    })
    // Re-create the hard-deleted slots as fresh `available` numbers.
    let backfilled = 0
    for (const b of backfill) {
      const created = await tx.editionNumber.createMany({
        data: b.missing.map((number) => ({ variantId: b.id, number })),
        skipDuplicates: true,
      })
      backfilled += created.count
    }
    const deletedCarts = await tx.pendingCart.deleteMany({})
    // Invoices BEFORE orders (Restrict FK) + counters so numbering restarts.
    const deletedInvoices = await tx.invoice.deleteMany({})
    const deletedCounters = await tx.invoiceCounter.deleteMany({})
    const deletedOrders = await tx.printOrder.deleteMany({}) // cascades items + events
    return {
      editionNumbersReset: reset.count,
      editionSlotsBackfilled: backfilled,
      pendingCartsDeleted: deletedCarts.count,
      invoicesDeleted: deletedInvoices.count,
      invoiceCountersDeleted: deletedCounters.count,
      printOrdersDeleted: deletedOrders.count,
    }
  })

  console.log('\n✅ DONE:', { ...result, invoicePdfsDeleted })
  console.log('Edition series reset to available + backfilled; all orders + staged carts cleared.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
