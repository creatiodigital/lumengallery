import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import { emailButton, emailDivider, emailHeading, emailLineItems, emailParagraph } from './components'
import { formatAmount } from './format'
import { EMAIL_BRAND } from './brand'
import { renderEmailLayout } from './layout'

const B = EMAIL_BRAND

const resend = new Resend(process.env.RESEND_API_KEY)

// EU member states (2026) — destinations where flat 21% VAT applies
// at checkout via OSS, so no import duty greets the buyer.
const EU_ISO_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
])

/**
 * Rough end-to-end delivery window by destination (production + shipping
 * on Standard tier). Indicative, not guaranteed —
 * framed orders can push the upper bound.
 */
function estimateDeliveryWindow(countryCode: string): { minDays: number; maxDays: number } {
  const cc = countryCode.toUpperCase()
  if (cc === 'GB') return { minDays: 3, maxDays: 7 }
  if (EU_ISO_CODES.has(cc)) return { minDays: 6, maxDays: 10 }
  if (cc === 'US' || cc === 'CA') return { minDays: 7, maxDays: 14 }
  if (cc === 'AU' || cc === 'NZ') return { minDays: 10, maxDays: 20 }
  return { minDays: 10, maxDays: 21 }
}

/**
 * True when the destination is likely to hit cross-border customs on
 * delivery. Ships from the UK; UK domestic and IOSS-covered
 * EU orders stay clean. Anywhere else, the shipment crosses a border
 * and the buyer may owe local tax/duty. We disclose it upfront so
 * there's no surprise at the door.
 */
function mayOweImportDuty(countryCode: string): boolean {
  const cc = countryCode.toUpperCase()
  if (cc === 'GB') return false
  if (cc === 'US') return false
  if (EU_ISO_CODES.has(cc)) return false
  return true
}

export type OrderPlacedArgs = {
  to: string
  buyerName: string
  orderId: string
  artworkTitle: string
  artistName: string
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

  const deliveryWindow = estimateDeliveryWindow(args.shippingCountryCode)
  const dutyLikely = mayOweImportDuty(args.shippingCountryCode)

  const dutyNote = dutyLikely
    ? `<p style="margin:0 0 16px;padding:12px 14px;background:#fff8e1;border:1px solid #f0c36d;font-size:13px;line-height:1.5;font-family:${B.fontStack};color:#111"><strong>Heads up on local taxes:</strong> Depending on the import rules in your country, you may be asked to pay a small amount of local tax or duty on delivery. This isn&rsquo;t something we charge &mdash; it goes to your local customs authority.</p>`
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
      `A temporary hold has been placed on your card &mdash; we&rsquo;ll only charge it once your print enters production. You&rsquo;ll get another email from us when that happens, and one more with tracking details as soon as it ships.`,
    ) +
    emailDivider() +
    emailParagraph(`<strong>Order</strong> #${safeOrderId}`) +
    emailLineItems([{ title: safeArtwork, artist: safeArtist, qty: 1 }], { label: 'Total', value: total }) +
    dutyNote +
    emailDivider() +
    emailButton('View your order', 'https://theartroom.gallery/account/orders') +
    emailParagraph(`If anything changes with your order, we&rsquo;ll be in touch right away.`)

  return {
    subject: 'Your order at The Art Room has been placed',
    html: renderEmailLayout({ preheader: 'Your order at The Art Room has been placed', bodyHtml: body }),
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
