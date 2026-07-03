import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import { emailHeading, emailParagraph } from './components'
import { renderEmailLayout } from './layout'

const resend = new Resend(process.env.RESEND_API_KEY)

export type InvoiceEmailArgs = {
  to: string
  buyerName: string
  /** Full document number, e.g. 'AR-06-2026-001'. */
  number: string
  /** The rendered PDF, attached to the email (never a link — house rule). */
  pdf: Buffer
  isCreditNote?: boolean
}

/**
 * Pure renderer — subject + HTML for the invoice / credit-note email.
 * The PDF itself rides as an attachment (added in sendInvoiceEmail).
 */
export function renderInvoiceEmail(
  args: Pick<InvoiceEmailArgs, 'buyerName' | 'number' | 'isCreditNote'>,
): { subject: string; html: string } {
  const firstName = escapeHtml(args.buyerName.split(' ')[0] || 'there')
  const doc = args.isCreditNote ? 'credit note' : 'invoice'
  const safeNumber = escapeHtml(args.number)

  const body =
    emailHeading(`Your ${doc}`) +
    emailParagraph(`Dear ${firstName},`) +
    emailParagraph(
      `Please find your ${doc} <strong>${safeNumber}</strong> attached to this email as a PDF.`,
    ) +
    emailParagraph(`Thank you for your purchase from The Art Room.`)

  const subject = args.isCreditNote
    ? 'Your credit note from The Art Room'
    : 'Your invoice from The Art Room'

  return {
    subject,
    html: renderEmailLayout({ preheader: subject, bodyHtml: body }),
  }
}

/**
 * Sends the invoice / credit note to the buyer with the PDF attached.
 * Resolves with `{ ok: false }` on failure rather than throwing.
 */
export async function sendInvoiceEmail(
  args: InvoiceEmailArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderInvoiceEmail(args)

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: args.to,
      subject,
      html,
      attachments: [{ filename: `${args.number}.pdf`, content: args.pdf }],
    })

    if (res.error) {
      return { ok: false, error: res.error.message ?? 'resend error' }
    }
    return { ok: true, id: res.data?.id ?? '' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
