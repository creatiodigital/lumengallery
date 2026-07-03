import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailDivider,
  emailEyebrow,
  emailHeading,
  emailLineItems,
  emailNotice,
  emailParagraph,
  type EmailSpec,
  type EmailSummaryRow,
} from './components'
import { formatAmount } from './format'
import { renderEmailLayout } from './layout'
import { estimateDeliveryWindow, mayOweImportDuty } from './delivery'

const resend = new Resend(process.env.RESEND_API_KEY)

export type OrderPlacedArgs = {
  to: string
  buyerName: string
  orderId: string
  artworkTitle: string
  artistName: string
  /** Chosen print options (size, paper, frame, edition…) to itemize on the receipt. */
  specs?: EmailSpec[]
  /** Retail price of the item (artist + gallery + production), in cents. */
  itemTotalCents?: number
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
 * Pure renderer — builds the subject and HTML for the order-placed email.
 * No side effects; safe to call from preview routes.
 */
export function renderOrderPlacedEmail(args: OrderPlacedArgs): { subject: string; html: string } {
  const rawFirstName = args.buyerName.split(' ')[0] || 'there'
  const firstName = escapeHtml(rawFirstName)
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeOrderId = escapeHtml(args.orderId.slice(0, 8))
  const total = formatAmount(args.totalCents, args.currency)
  const safeSpecs = args.specs?.map((s) => ({
    label: escapeHtml(s.label),
    value: escapeHtml(s.value),
  }))
  const itemPrice =
    args.itemTotalCents != null ? formatAmount(args.itemTotalCents, args.currency) : undefined

  // Full price breakdown when the money fields are supplied; otherwise just the total.
  const hasBreakdown =
    args.itemTotalCents != null && args.shippingCents != null && args.vatCents != null
  const summary: EmailSummaryRow[] = hasBreakdown
    ? [
        { label: 'Subtotal', value: formatAmount(args.itemTotalCents!, args.currency) },
        { label: 'Shipping', value: formatAmount(args.shippingCents!, args.currency) },
        { label: args.vatLabel ?? 'VAT', value: formatAmount(args.vatCents!, args.currency) },
        { label: 'Total', value: total, strong: true },
      ]
    : [{ label: 'Total', value: total, strong: true }]

  const deliveryWindow = estimateDeliveryWindow(args.shippingCountryCode)
  const dutyLikely = mayOweImportDuty(args.shippingCountryCode)

  const dutyNote = dutyLikely
    ? emailNotice(
        'caution',
        '<strong>Heads up on local taxes:</strong> Depending on the import rules in your country, you may be asked to pay a small amount of local tax or duty on delivery. This isn&rsquo;t something we charge &mdash; it goes to your local customs authority.',
      )
    : ''

  const body =
    emailHeading(`Thank you, ${firstName}`) +
    emailParagraph(
      `Thanks for your order. We&rsquo;ve received all your details and your print is being prepared.`,
    ) +
    emailParagraph(
      `<strong>Expected delivery:</strong> ${deliveryWindow.minDays}&ndash;${deliveryWindow.maxDays} business days from today. Framed prints can occasionally take a few days longer to make.`,
    ) +
    emailParagraph(
      `A temporary hold has been placed on your card &mdash; we&rsquo;ll only charge it once your print enters production. We&rsquo;ll email your invoice with that charge, and send tracking details as soon as it ships.`,
    ) +
    emailDivider() +
    emailEyebrow(`Order ${safeOrderId.toUpperCase()}`) +
    emailLineItems(
      [
        {
          title: safeArtwork,
          artist: safeArtist,
          specs: safeSpecs,
          quantity: 1,
          unitPrice: itemPrice,
          lineTotal: itemPrice,
        },
      ],
      summary,
    ) +
    dutyNote +
    emailDivider() +
    emailParagraph(`If anything changes with your order, we&rsquo;ll be in touch right away.`)

  return {
    subject: 'Your order at The Art Room has been placed',
    html: renderEmailLayout({
      preheader: 'Your order at The Art Room has been placed',
      bodyHtml: body,
    }),
  }
}

/**
 * Sent to the buyer immediately after their card authorization succeeds.
 * The charge happens later, once the print enters production — the copy
 * explicitly calls this out so the buyer isn't surprised by a delayed
 * charge.
 *
 * Resolves with `{ ok: false }` on failure rather than throwing, so the
 * caller can log + continue without aborting the webhook.
 */
export async function sendOrderPlacedEmail(
  args: OrderPlacedArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderOrderPlacedEmail(args)

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
