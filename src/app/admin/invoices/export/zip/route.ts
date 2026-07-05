import JSZip from 'jszip'

import { auth } from '@/auth'
import { isAdminOrAbove } from '@/lib/authUtils'
import { queryInvoices, exportPeriodLabel } from '@/lib/invoices/queryInvoices'
import { getR2ObjectBuffer } from '@/lib/r2'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// R2 fetches run in parallel batches of this size — a year-end export of a
// few hundred PDFs must finish well inside the function timeout.
const FETCH_BATCH_SIZE = 8

/**
 * AR-131 — Export the CURRENTLY FILTERED invoices' PDFs as a single ZIP.
 * Uses the SAME queryInvoices helper as the register page and the CSV export,
 * so "filter to a month → export → one zip of that month's invoices" always
 * matches what the register showed. Admin-guarded.
 *
 * An invoice row can exist whose PDF never reached R2 (upload is non-fatal by
 * design — the number is committed first). Those are never silently omitted:
 * the ZIP gains a MISSING-PDFS.txt manifest naming them, so the accountant
 * can see the gap is a fetch problem, not a numbering gap.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id || !isAdminOrAbove(session.user.userType)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url)
  const yearParam = url.searchParams.get('year')
  const monthParam = url.searchParams.get('month')
  const client = (url.searchParams.get('client') ?? '').trim()

  const year = yearParam && !Number.isNaN(Number(yearParam)) ? Number(yearParam) : undefined
  const month = monthParam && !Number.isNaN(Number(monthParam)) ? Number(monthParam) : undefined
  const filter = { year, month, ...(client ? { client } : {}) }

  const invoices = await queryInvoices(filter)
  if (invoices.length === 0) {
    return new Response('No invoices match the current filter.', { status: 404 })
  }

  // queryInvoices deliberately doesn't expose r2Keys to the client — fetch
  // them here by id for the server-side R2 reads.
  const keyRows = await prisma.invoice.findMany({
    where: { id: { in: invoices.map((i) => i.id) } },
    select: { id: true, r2Key: true },
  })
  const keyById = new Map(keyRows.map((r) => [r.id, r.r2Key]))

  const zip = new JSZip()
  const missing: string[] = []
  let added = 0

  for (let i = 0; i < invoices.length; i += FETCH_BATCH_SIZE) {
    const batch = invoices.slice(i, i + FETCH_BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (inv) => {
        const key = keyById.get(inv.id)
        if (!key) throw new Error('no r2Key')
        return { number: inv.number, pdf: await getR2ObjectBuffer(key) }
      }),
    )
    results.forEach((res, j) => {
      if (res.status === 'fulfilled') {
        zip.file(`${res.value.number}.pdf`, res.value.pdf)
        added++
      } else {
        missing.push(batch[j].number)
      }
    })
  }

  if (added === 0) {
    return new Response('No invoice PDFs available for this filter.', { status: 404 })
  }
  if (missing.length > 0) {
    zip.file(
      'MISSING-PDFS.txt',
      [
        'The following documents exist in the register but their PDF could not be',
        'fetched from storage. This is NOT a numbering gap — re-send each document',
        'from its order page to regenerate and archive the PDF, then re-export.',
        '',
        ...missing,
        '',
      ].join('\n'),
    )
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  const filename = `AR-invoices-${exportPeriodLabel(filter)}.zip`

  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Missing-Pdfs': String(missing.length),
    },
  })
}
