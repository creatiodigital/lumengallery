import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailDetailRows,
  emailDivider,
  emailEyebrow,
  emailHeading,
  emailParagraph,
} from './components'
import { formatAmount } from './format'
import { renderEmailLayout } from './layout'

const resend = new Resend(process.env.RESEND_API_KEY)

type RefundIssuedArgs = {
  to: string
  buyerName: string
  orderId: string
  amountCents: number
  currency: string
}

/**
 * Pure renderer — builds the subject and HTML for the refund-issued email.
 * No side effects; safe to call from preview routes.
 */
export function renderRefundIssuedEmail(
  args: RefundIssuedArgs,
): { subject: string; html: string } {
  const firstName = escapeHtml(args.buyerName.split(' ')[0] || 'there')
  const safeOrderId = escapeHtml(args.orderId.slice(0, 8)).toUpperCase()
  const amount = formatAmount(args.amountCents, args.currency)

  const body =
    emailHeading(`Your refund is on its way, ${firstName}`) +
    emailParagraph(
      `We&rsquo;ve issued a refund for your order. The amount will be returned to the card you used for the original purchase.`,
    ) +
    emailDivider() +
    emailEyebrow(`Order ${safeOrderId}`) +
    emailDetailRows([{ label: 'Refund', value: amount }]) +
    emailDivider() +
    emailParagraph(
      `Depending on your bank, it may take <strong>5&ndash;10 business days</strong> to appear on your statement.`,
    ) +
    emailParagraph(
      `We&rsquo;re sorry this order didn&rsquo;t work out. Thank you for giving us the chance, and please don&rsquo;t hesitate to reach out if there&rsquo;s anything else we can help with.`,
    )

  return {
    subject: 'Your refund from The Art Room',
    html: renderEmailLayout({ preheader: 'Your refund from The Art Room', bodyHtml: body }),
  }
}

/**
 * Sent to the buyer when a refund is issued. Deliberately short and
 * apologetic — no mention of the vendor side, no justification required.
 * We're the face of the transaction.
 */
export async function sendRefundIssuedEmail(
  args: RefundIssuedArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderRefundIssuedEmail(args)

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: args.to,
      subject,
      html,
    })

    if (res.error) {
      return { ok: false, error: res.error.message ?? 'resend error' }
    }
    return { ok: true, id: res.data?.id ?? '' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
