import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailDivider,
  emailEyebrow,
  emailHeading,
  emailLineItems,
  emailNotice,
  emailParagraph,
  type EmailLineItem,
  type EmailSpec,
  type EmailSummaryRow,
} from './components'
import { formatAmount } from './format'
import { renderEmailLayout } from './layout'
import { estimateDeliveryWindow, mayOweImportDuty } from './delivery'

const resend = new Resend(process.env.RESEND_API_KEY)

/** One purchased line, summarized for the buyer's confirmation email. */
export type CartOrderPlacedLine = {
  artworkTitle: string
  artistName: string
  quantity: number
  /** Chosen print options (size, paper, frame, edition…) for this line. */
  specs?: EmailSpec[]
  /** Retail price for the line (unit retail × quantity), in cents. */
  lineTotalCents?: number
}

type CartOrderPlacedArgs = {
  to: string
  buyerName: string
  orderId: string
  lines: CartOrderPlacedLine[]
  /** Sum of line retail prices (pre-shipping, pre-VAT), in cents. */
  subtotalCents?: number
  /** Shipping charged to the buyer, in cents. */
  shippingCents?: number
  /** VAT charged to the buyer, in cents. */
  vatCents?: number
  /** Label for the VAT line, e.g. 'VAT (ES 21%)'. Defaults to 'VAT'. */
  vatLabel?: string
  totalCents: number
  currency: string
  /** ISO-2 shipping destination — shapes the delivery estimate + duty note. */
  shippingCountryCode: string
}

/**
 * Pure renderer — builds the subject and HTML for the cart order-placed email.
 * No side effects; safe to call from preview routes.
 */
export function renderCartOrderPlacedEmail(args: CartOrderPlacedArgs): { subject: string; html: string } {
  const rawFirstName = args.buyerName.split(' ')[0] || 'there'
  const firstName = escapeHtml(rawFirstName)
  const safeOrderId = escapeHtml(args.orderId.slice(0, 8))

  const deliveryWindow = estimateDeliveryWindow(args.shippingCountryCode)
  const dutyLikely = mayOweImportDuty(args.shippingCountryCode)

  const items: EmailLineItem[] = args.lines.map((l) => ({
    title: escapeHtml(l.artworkTitle),
    artist: escapeHtml(l.artistName),
    specs: l.specs?.map((s) => ({ label: escapeHtml(s.label), value: escapeHtml(s.value) })),
    quantity: l.quantity,
    unitPrice:
      l.lineTotalCents != null
        ? formatAmount(Math.round(l.lineTotalCents / l.quantity), args.currency)
        : undefined,
    lineTotal: l.lineTotalCents != null ? formatAmount(l.lineTotalCents, args.currency) : undefined,
  }))

  const total = formatAmount(args.totalCents, args.currency)
  const hasBreakdown =
    args.subtotalCents != null && args.shippingCents != null && args.vatCents != null
  const summary: EmailSummaryRow[] = hasBreakdown
    ? [
        { label: 'Subtotal', value: formatAmount(args.subtotalCents!, args.currency) },
        { label: 'Shipping', value: formatAmount(args.shippingCents!, args.currency) },
        { label: args.vatLabel ?? 'VAT', value: formatAmount(args.vatCents!, args.currency) },
        { label: 'Total', value: total, strong: true },
      ]
    : [{ label: 'Total', value: total, strong: true }]

  const dutyNote = dutyLikely
    ? emailNotice('caution', '<strong>Heads up on local taxes:</strong> Depending on the import rules in your country, you may be asked to pay a small amount of local tax or duty on delivery. This isn&rsquo;t something we charge &mdash; it goes to your local customs authority.')
    : ''

  const body =
    emailHeading(`Thank you, ${firstName}`) +
    emailParagraph(
      `Thanks for your order. We&rsquo;ve received all your details and your prints are being prepared.`,
    ) +
    emailParagraph(
      `<strong>Expected delivery:</strong> ${deliveryWindow.minDays}&ndash;${deliveryWindow.maxDays} business days from today. Framed prints can occasionally take a few days longer to make.`,
    ) +
    emailParagraph(
      `A temporary hold has been placed on your card &mdash; we&rsquo;ll only charge it once your prints enter production. We&rsquo;ll email your invoice with that charge, and send tracking details as soon as your order ships.`,
    ) +
    emailDivider() +
    emailEyebrow(`Order ${safeOrderId.toUpperCase()}`) +
    emailLineItems(items, summary) +
    dutyNote +
    emailDivider() +
    emailParagraph(`If anything changes with your order, we&rsquo;ll be in touch right away.`)

  return {
    subject: 'Your order at The Art Room has been placed',
    html: renderEmailLayout({ preheader: 'Your order at The Art Room has been placed', bodyHtml: body }),
  }
}

/**
 * Multi-item (cart) variant of {@link sendOrderPlacedEmail}. Same copy and
 * payment-model disclosure, but lists every purchased line rather than a
 * single artwork. Sent to the buyer immediately after their card
 * authorization succeeds; the charge happens later, once the prints enter
 * production.
 *
 * Resolves with `{ ok: false }` on failure rather than throwing, so the
 * caller can log + continue without aborting the webhook.
 */
export async function sendCartOrderPlacedEmail(
  args: CartOrderPlacedArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderCartOrderPlacedEmail(args)

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
