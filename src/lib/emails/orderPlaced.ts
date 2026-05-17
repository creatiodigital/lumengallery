import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'

const resend = new Resend(process.env.RESEND_API_KEY)

function formatAmount(cents: number, currency: string): string {
  const symbol = currency.toLowerCase() === 'eur' ? '€' : currency.toUpperCase() + ' '
  return `${symbol}${(cents / 100).toFixed(2)}`
}

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
 * on theprintspace's Standard tier). Indicative, not guaranteed —
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
 * delivery. the print provider ships from the UK; UK domestic and IOSS-covered
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

type OrderPlacedArgs = {
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

  const safeBuyerName = escapeHtml(args.buyerName || 'there')
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeOrderId = escapeHtml(args.orderId.slice(0, 8))
  const total = formatAmount(args.totalCents, args.currency)

  const deliveryWindow = estimateDeliveryWindow(args.shippingCountryCode)
  const dutyLikely = mayOweImportDuty(args.shippingCountryCode)

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: args.to,
      subject: 'Your order at The Art Room has been placed',
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 22px; margin: 0 0 16px 0;">Your order has been placed</h2>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">Hi ${safeBuyerName},</p>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            Thanks for your order. We&rsquo;ve received all your details and your print is being prepared.
          </p>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            <strong>Expected delivery:</strong> ${deliveryWindow.minDays}&ndash;${deliveryWindow.maxDays}
            business days from today. Framed prints can occasionally take a few days longer to make.
          </p>

          <p style="margin: 0 0 24px 0; line-height: 1.55;">
            A temporary hold has been placed on your card &mdash; we&rsquo;ll only charge it once your print
            enters production. You&rsquo;ll get another email from us when that happens, and one more
            with tracking details as soon as it ships.
          </p>

          <div style="background:#f6f6f6; padding:16px 20px; margin: 0 0 24px 0;">
            <p style="margin:0 0 8px 0;"><strong>Order</strong> #${safeOrderId}</p>
            <p style="margin:0 0 8px 0;">${safeArtwork} &mdash; ${safeArtist}</p>
            <p style="margin:0;"><strong>Total</strong> ${total}</p>
          </div>

          ${
            dutyLikely
              ? `<p style="margin:0 0 16px 0; padding:12px 14px; background:#fff8e1; border:1px solid #f0c36d; font-size:13px; line-height:1.5;">
                   <strong>Heads up on local taxes:</strong> Depending on the import rules in your
                   country, you may be asked to pay a small amount of local tax or duty on delivery.
                   This isn&rsquo;t something we charge &mdash; it goes to your local customs authority.
                 </p>`
              : ''
          }

          <p style="margin: 0 0 8px 0; line-height: 1.55;">
            If anything changes with your order, we&rsquo;ll be in touch right away.
          </p>

          <p style="margin: 24px 0 0 0; color:#666; font-size: 13px;">&mdash; The Art Room</p>
        </div>
      `,
    })

    if (res.error) {
      return { ok: false, error: res.error.message ?? 'resend error' }
    }
    return { ok: true, id: res.data?.id ?? '' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
