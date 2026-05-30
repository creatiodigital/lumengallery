import { Prisma } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'

/**
 * Write-helpers used by the Stripe specs: cleaning up any PrintOrder row
 * a webhook may have created (the delete helpers), and seeding a known
 * `Artwork.printOptions` state so the restriction-clash contract test is
 * meaningful (the set/restore helpers). These are the only e2e helpers
 * that write.
 *
 * Cleanup helpers (delete*, restore*) are best-effort — they log but
 * never throw so they can run in `finally` blocks without masking the
 * real assertion failure. Seed helpers (set*) throw, because a test
 * that can't establish its precondition shouldn't proceed.
 */

const POLL_INTERVAL_MS = 500
const POLL_TIMEOUT_MS = 15_000

/** Poll until a PrintOrder exists for the given paymentIntentId, or timeout. */
export async function waitForPrintOrderByPaymentIntent(
  paymentIntentId: string,
): Promise<{ id: string; paymentIntentId: string } | null> {
  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const order = await prisma.printOrder.findUnique({
      where: { paymentIntentId },
      select: { id: true, paymentIntentId: true },
    })
    if (order) return order
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  return null
}

/**
 * Best-effort cleanup. Cascades remove PrintOrderEvent rows via the
 * `onDelete: Cascade` on the relation. If the order doesn't exist
 * (e.g., webhook never fired), this is a no-op.
 */
export async function deletePrintOrderByPaymentIntent(paymentIntentId: string): Promise<void> {
  try {
    await prisma.printOrder.deleteMany({ where: { paymentIntentId } })
  } catch (err) {
    console.warn(
      `[e2e cleanup] delete by paymentIntentId=${paymentIntentId} failed:`,
      err instanceof Error ? err.message : err,
    )
  }
}

/** Same as above but by orderId, for tests that already have it. */
export async function deletePrintOrderById(orderId: string): Promise<void> {
  try {
    await prisma.printOrder.deleteMany({ where: { id: orderId } })
  } catch (err) {
    console.warn(
      `[e2e cleanup] delete by id=${orderId} failed:`,
      err instanceof Error ? err.message : err,
    )
  }
}

/**
 * Seed `Artwork.printOptions` to a known value for a single spec run.
 * Returns the previous value so the test can put it back in `finally`.
 * Throws if the artwork doesn't exist — the spec depends on this state.
 */
export async function setArtworkPrintOptions(
  slug: string,
  value: Prisma.InputJsonValue,
): Promise<Prisma.JsonValue> {
  const prev = await prisma.artwork.findUnique({
    where: { slug },
    select: { printOptions: true },
  })
  if (!prev) {
    throw new Error(`Artwork "${slug}" not found — can't seed printOptions`)
  }
  await prisma.artwork.update({
    where: { slug },
    data: { printOptions: value },
  })
  return prev.printOptions
}

/**
 * Best-effort restore of `Artwork.printOptions` to a previously captured
 * value. Maps JS `null` → `Prisma.DbNull` so a DB NULL round-trips
 * correctly. Logs and swallows errors so it's safe in `finally`.
 */
export async function restoreArtworkPrintOptions(
  slug: string,
  previous: Prisma.JsonValue,
): Promise<void> {
  try {
    await prisma.artwork.update({
      where: { slug },
      data: {
        printOptions:
          previous === null ? Prisma.DbNull : (previous as Prisma.InputJsonValue),
      },
    })
  } catch (err) {
    console.warn(
      `[e2e cleanup] restore printOptions for slug=${slug} failed:`,
      err instanceof Error ? err.message : err,
    )
  }
}
