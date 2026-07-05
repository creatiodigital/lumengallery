/**
 * Dev/staging test-data cleanup — the SINGLE implementation behind both the
 * CLI (`scripts/reset-test-orders.ts`) and the admin-dashboard "Dev cleanup"
 * button. Wipes every order, invoice (+ its private R2 PDF), invoice counter
 * and staged cart, and resets all limited-edition series to a clean 1..N
 * `available` state.
 *
 * HARD-BLOCKED in production: issued invoices are legal documents and orders
 * are business records — this exists ONLY to clear test noise on the shared
 * dev database (localhost + staging).
 */
import prisma from '@/lib/prisma'
import { deletePrivateR2Key } from '@/lib/r2'

/** Cleanup is allowed everywhere EXCEPT production. */
export function devCleanupAllowed(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV !== 'production'
}

export type TestDataCounts = {
  printOrders: number
  printOrderItems: number
  printOrderEvents: number
  pendingCarts: number
  invoices: number
  invoiceCounters: number
  editionNumbersHeld: number
  editionSlotsToBackfill: number
}

type BackfillPlan = { id: string; name: string; missing: number[] }[]

async function gatherBackfillPlan(): Promise<BackfillPlan> {
  // Which 1..editionSize slots are MISSING on each published variant
  // (hard-deleted in earlier testing). Re-created as `available` so the
  // edition is whole again and the next sale gets 1/N, not 3/N.
  const publishedVariants = await prisma.limitedVariant.findMany({
    where: { published: true },
    select: {
      id: true,
      name: true,
      editionSize: true,
      editionNumbers: { select: { number: true } },
    },
  })
  return publishedVariants
    .map((v) => {
      const present = new Set(v.editionNumbers.map((e) => e.number))
      const missing: number[] = []
      for (let n = 1; n <= v.editionSize; n++) if (!present.has(n)) missing.push(n)
      return { id: v.id, name: v.name, missing }
    })
    .filter((b) => b.missing.length > 0)
}

/** What a reset WOULD touch — used by the CLI dry run and the confirm modal. */
export async function countTestData(): Promise<TestDataCounts> {
  const [orders, items, events, carts, held, invoices, counters, backfill] = await Promise.all([
    prisma.printOrder.count(),
    prisma.printOrderItem.count(),
    prisma.printOrderEvent.count(),
    prisma.pendingCart.count(),
    prisma.editionNumber.count({ where: { state: { in: ['reserved', 'sold'] } } }),
    prisma.invoice.count(),
    prisma.invoiceCounter.count(),
    gatherBackfillPlan(),
  ])
  return {
    printOrders: orders,
    printOrderItems: items,
    printOrderEvents: events,
    pendingCarts: carts,
    invoices,
    invoiceCounters: counters,
    editionNumbersHeld: held,
    editionSlotsToBackfill: backfill.reduce((sum, b) => sum + b.missing.length, 0),
  }
}

export type ResetTestDataSummary = {
  editionNumbersReset: number
  editionSlotsBackfilled: number
  pendingCartsDeleted: number
  invoicesDeleted: number
  invoicePdfsDeleted: number
  invoiceCountersDeleted: number
  printOrdersDeleted: number
}

export async function resetTestData(): Promise<ResetTestDataSummary> {
  if (!devCleanupAllowed()) {
    throw new Error('Refusing to reset data: NEXT_PUBLIC_APP_ENV is production.')
  }

  const [invoiceRows, backfill] = await Promise.all([
    prisma.invoice.findMany({ select: { r2Key: true } }),
    gatherBackfillPlan(),
  ])

  // Delete invoice PDFs from R2 first (network I/O — kept outside the tx).
  // Test invoices must go with their orders: Invoice.orderId is onDelete:
  // Restrict, so leaving them would abort the printOrder.deleteMany below.
  let invoicePdfsDeleted = 0
  for (const inv of invoiceRows) {
    if (inv.r2Key) {
      try {
        await deletePrivateR2Key(inv.r2Key)
        invoicePdfsDeleted++
      } catch (err) {
        console.warn(
          '[resetTestData] R2 invoice PDF delete failed:',
          err instanceof Error ? err.message : err,
        )
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

  return { ...result, invoicePdfsDeleted }
}
