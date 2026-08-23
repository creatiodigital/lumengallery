import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailButton,
  emailDetailRows,
  emailDivider,
  emailEyebrow,
  emailParagraph,
} from './components'
import { formatAmount } from './format'
import { renderEmailLayout } from './layout'
import { ADMIN_EMAIL_TO, ADMIN_EMAIL_CC } from './recipients'
import { formatOrderRef } from '@/lib/orders/orderRef'

const resend = new Resend(process.env.RESEND_API_KEY)

type ShippingAddress = {
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
}

type AdminOrderNotificationArgs = {
  orderId: string
  artworkTitle: string
  artistName: string
  buyerName: string
  buyerEmail: string
  shippingAddress: ShippingAddress
  totalCents: number
  currency: string
  /** Spec rows (Print type / Paper / Frame / etc.) the admin pastes
   *  into the fulfillment portal by hand. */
  skuAttributes: Record<string, string>
  adminOrderUrl: string
}

/**
 * Pure renderer — builds the subject and HTML for the admin order notification email.
 * No side effects; safe to call from preview routes.
 */
export function renderAdminOrderNotificationEmail(args: AdminOrderNotificationArgs): {
  subject: string
  html: string
} {
  const id8 = formatOrderRef(args.orderId)
  const safeId8 = escapeHtml(id8)
  const safeOrderIdFull = escapeHtml(args.orderId)
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeBuyerName = escapeHtml(args.buyerName || '—')
  const safeBuyerEmail = escapeHtml(args.buyerEmail || '—')
  const safeAdminUrl = escapeHtml(args.adminOrderUrl)
  const total = formatAmount(args.totalCents, args.currency)

  const addr = args.shippingAddress
  const addrParts = [
    escapeHtml(addr.line1),
    addr.line2 ? escapeHtml(addr.line2) : null,
    `${escapeHtml(addr.postalCode)} ${escapeHtml(addr.city)}${addr.state ? ', ' + escapeHtml(addr.state) : ''}`,
    escapeHtml(addr.country),
  ].filter(Boolean) as string[]
  const safeAddress = addrParts.join('<br>')

  const specRows = Object.entries(args.skuAttributes).map(([k, v]) => ({
    label: escapeHtml(k),
    value: escapeHtml(v),
  }))

  const recipientRows = [
    { label: 'Name', value: safeBuyerName },
    { label: 'Email', value: safeBuyerEmail },
    ...(addr.phone ? [{ label: 'Phone', value: escapeHtml(addr.phone) }] : []),
    { label: 'Address', value: safeAddress },
  ]

  const body =
    emailEyebrow(`Order #${safeId8}`) +
    `<h2 style="margin:0 0 12px;font-size:18px;font-weight:700;line-height:1.3;color:#111111">New order &mdash; needs fulfillment</h2>` +
    emailParagraph(`Order #${safeId8} &middot; ${total}`) +
    emailButton('Open in admin', safeAdminUrl) +
    emailDivider() +
    emailEyebrow('Artwork') +
    emailDetailRows([
      { label: 'Title', value: safeArtwork },
      { label: 'Artist', value: safeArtist },
    ]) +
    emailEyebrow('Specs') +
    emailDetailRows(specRows) +
    emailParagraph(
      'The print asset is available in the admin order page above. It is never linked from email &mdash; the original artwork is sale-sensitive content.',
    ) +
    emailDivider() +
    emailEyebrow('Recipient') +
    emailDetailRows(recipientRows) +
    emailDetailRows([{ label: 'Shipping', value: 'Standard' }]) +
    emailParagraph(
      `<span style="color:#888888;font-size:12px">Full order ID: <span style="font-family:monospace">${safeOrderIdFull}</span></span>`,
    )

  return {
    subject: `New order #${id8} — ${args.artworkTitle} — needs fulfillment`,
    html: renderEmailLayout({
      preheader: `New order #${id8} — ${args.artworkTitle} — needs fulfillment`,
      bodyHtml: body,
    }),
  }
}

/**
 * Sent to the gallery admin every time a buyer's card authorization
 * succeeds. Surfaces every field needed to place the order in the
 * fulfillment portal by hand (manual fulfillment mode).
 *
 * Resolves with `{ ok: false }` on failure rather than throwing, so the
 * caller can log + continue without aborting the webhook.
 */
export async function sendAdminOrderNotification(
  args: AdminOrderNotificationArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderAdminOrderNotificationEmail(args)

  try {
    const res = await resend.emails.send({
      from: `The Art Room Orders <${fromEmail}>`,
      to: ADMIN_EMAIL_TO,
      cc: ADMIN_EMAIL_CC,
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
