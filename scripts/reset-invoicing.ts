/**
 * AR-131 DEV-ONLY: hard-wipe all Invoice + InvoiceCounter rows and delete
 * their R2 PDFs, so numbering restarts at 001.
 *
 * ⚠️  WARNING: local + staging share the SAME dev database. Running this
 *     script wipes invoices in BOTH environments simultaneously.
 *
 * Safety (mirrors reset-test-orders.ts):
 *   - HARD REFUSES when NODE_ENV or NEXT_PUBLIC_APP_ENV is 'production'.
 *   - Default run is a DRY RUN: prints the DB host + counts, changes nothing.
 *   - Mutations require the explicit --confirm flag.
 *
 * Usage:
 *   npx tsx scripts/reset-invoicing.ts            (dry run)
 *   npx tsx scripts/reset-invoicing.ts --confirm  (execute)
 */

import 'dotenv/config'

// Load .env.local (same as the app)
import { config as loadDotenv } from 'dotenv'
import path from 'node:path'
loadDotenv({ path: path.join(process.cwd(), '.env.local') })

import prisma from '@/lib/prisma'
import { deletePrivateR2Key } from '@/lib/r2'

const CONFIRM = process.argv.includes('--confirm')

async function main() {
  // Hard production guard — never run destructive ops on prod data.
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_APP_ENV === 'production'
  ) {
    console.error(
      '[reset-invoicing] REFUSED: NODE_ENV or NEXT_PUBLIC_APP_ENV is "production". ' +
        'This script is for development and staging only.',
    )
    process.exit(1)
  }

  const dbHost =
    (process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL ?? '').match(/@([^/:]+)/)?.[1] ??
    '(unknown)'

  const [invoices, counters] = await Promise.all([
    prisma.invoice.findMany({ select: { id: true, number: true, r2Key: true } }),
    prisma.invoiceCounter.count(),
  ])

  console.log('=== RESET INVOICING ===')
  console.log('APP_ENV :', process.env.NEXT_PUBLIC_APP_ENV ?? '(unset)')
  console.log('DB host :', dbHost, '  (NOTE: local + staging share this DB)')
  console.log('Will DELETE →', { invoices: invoices.length, invoiceCounters: counters })

  if (!CONFIRM) {
    console.log('\nDRY RUN — nothing changed. Re-run with --confirm to execute.')
    return
  }

  console.log(`[reset-invoicing] Deleting ${invoices.length} R2 PDF(s)...`)
  let r2Deleted = 0
  let r2Failed = 0
  for (const inv of invoices) {
    if (inv.r2Key) {
      try {
        await deletePrivateR2Key(inv.r2Key)
        r2Deleted++
      } catch (err) {
        console.warn(
          `[reset-invoicing] R2 delete failed for key=${inv.r2Key}:`,
          err instanceof Error ? err.message : err,
        )
        r2Failed++
      }
    }
  }
  console.log(`[reset-invoicing] R2 PDFs: ${r2Deleted} deleted, ${r2Failed} failed.`)

  const { count: invoiceCount } = await prisma.invoice.deleteMany()
  console.log(`[reset-invoicing] Deleted ${invoiceCount} Invoice row(s).`)

  const { count: counterCount } = await prisma.invoiceCounter.deleteMany()
  console.log(`[reset-invoicing] Deleted ${counterCount} InvoiceCounter row(s).`)

  console.log('[reset-invoicing] Done — next issue starts at 001.')
}

main()
  .catch((err) => {
    console.error('[reset-invoicing] Fatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
