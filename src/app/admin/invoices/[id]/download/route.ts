import { auth } from '@/auth'
import { isAdminOrAbove } from '@/lib/authUtils'
import { getR2ObjectBuffer } from '@/lib/r2'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // ── Admin-session guard (mirrors requireAdminSession in actions.ts) ──────
  const session = await auth()
  if (!session?.user?.id || !isAdminOrAbove(session.user.userType)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id } = await params

  // ── Load the invoice ─────────────────────────────────────────────────────
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { r2Key: true, number: true },
  })
  if (!invoice) {
    return new Response('Invoice not found', { status: 404 })
  }

  // ── Fetch the PDF bytes from R2 ──────────────────────────────────────────
  let pdf: Buffer
  try {
    pdf = await getR2ObjectBuffer(invoice.r2Key)
  } catch {
    return new Response('PDF not available', { status: 404 })
  }

  // ── Return the PDF inline so it opens in the browser tab ─────────────────
  // Convert Node Buffer → Uint8Array so Response's BodyInit accepts it.
  const filename = `${invoice.number}.pdf`
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': String(pdf.byteLength),
      'Cache-Control': 'private, no-store',
    },
  })
}
