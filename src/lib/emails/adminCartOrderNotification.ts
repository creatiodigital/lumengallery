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

/** One purchased line, with the specs the admin pastes into the fulfillment portal. */
export type AdminCartOrderLine = {
  artworkTitle: string
  artistName: string
  quantity: number
  /** Spec rows (Print type / Paper / Frame / etc.) for this line. */
  skuAttributes: Record<string, string>
}

type AdminCartOrderNotificationArgs = {
  orderId: string
  lines: AdminCartOrderLine[]
  buyerName: string
  buyerEmail: string
  shippingAddress: ShippingAddress
  totalCents: number
  currency: string
  adminOrderUrl: string
}

/**
 * Pure renderer — builds the subject and HTML for the admin cart order notification email.
 * No side effects; safe to call from preview routes.
 */
export function renderAdminCartOrderNotificationEmail(args: AdminCartOrderNotificationArgs): {
  subject: string
  html: string
} {
  const id8 = args.orderId.slice(0, 8).toUpperCase()
  const safeId8 = escapeHtml(id8)
  const safeOrderIdFull = escapeHtml(args.orderId)
  const safeBuyerName = escapeHtml(args.buyerName || '—')
  const safeBuyerEmail = escapeHtml(args.buyerEmail || '—')
  const safeAdminUrl = escapeHtml(args.adminOrderUrl)
  const total = formatAmount(args.totalCents, args.currency)
  const lineCount = args.lines.length

  const addr = args.shippingAddress
  const addrParts = [
    escapeHtml(addr.line1),
    addr.line2 ? escapeHtml(addr.line2) : null,
    `${escapeHtml(addr.postalCode)} ${escapeHtml(addr.city)}${addr.state ? ', ' + escapeHtml(addr.state) : ''}`,
    escapeHtml(addr.country),
  ].filter(Boolean) as string[]
  const safeAddress = addrParts.join('<br>')

  const lineBlocks = args.lines
    .map((line, i) => {
      const specRows = Object.entries(line.skuAttributes).map(([k, v]) => ({
        label: escapeHtml(k),
        value: escapeHtml(v),
      }))
      const safeTitle = escapeHtml(line.artworkTitle)
      const safeArtist = escapeHtml(line.artistName)
      const qtyStr = `${line.quantity}`
      return (
        emailEyebrow(`Item ${i + 1} of ${lineCount}`) +
        emailDetailRows([
          { label: 'Title', value: safeTitle },
          { label: 'Artist', value: safeArtist },
          { label: 'Quantity', value: qtyStr },
        ]) +
        emailDetailRows(specRows)
      )
    })
    .join(emailDivider())

  const recipientRows = [
    { label: 'Name', value: safeBuyerName },
    { label: 'Email', value: safeBuyerEmail },
    ...(addr.phone ? [{ label: 'Phone', value: escapeHtml(addr.phone) }] : []),
    { label: 'Address', value: safeAddress },
  ]

  const body =
    emailEyebrow(`Order #${safeId8}`) +
    `<h2 style="margin:0 0 12px;font-size:18px;font-weight:700;line-height:1.3;color:#111111">New cart order &mdash; needs fulfillment</h2>` +
    emailParagraph(`Order #${safeId8} &middot; ${lineCount} item(s) &middot; ${total}`) +
    emailButton('Open in admin', safeAdminUrl) +
    emailDivider() +
    lineBlocks +
    emailDivider() +
    emailParagraph(
      'The print assets are available in the admin order page above. They are never linked from email &mdash; the original artwork is sale-sensitive content.',
    ) +
    emailDivider() +
    emailEyebrow('Recipient') +
    emailDetailRows(recipientRows) +
    emailDetailRows([{ label: 'Shipping', value: 'Standard' }]) +
    emailParagraph(
      `<span style="color:#888888;font-size:12px">Full order ID: <span style="font-family:monospace">${safeOrderIdFull}</span></span>`,
    )

  return {
    subject: `New cart order #${id8} — ${lineCount} item(s) — needs fulfillment`,
    html: renderEmailLayout({
      preheader: `New cart order #${id8} — ${lineCount} item(s) — needs fulfillment`,
      bodyHtml: body,
    }),
  }
}

/**
 * Multi-item (cart) variant of {@link sendAdminOrderNotification}. Sent to
 * the gallery admin every time a cart order's card authorization succeeds.
 * Lists EVERY line item with its own specs so the admin can place each at the
 * fulfillment portal by hand (manual fulfillment mode).
 *
 * Resolves with `{ ok: false }` on failure rather than throwing, so the
 * caller can log + continue without aborting the webhook.
 */
export async function sendAdminCartOrderNotification(
  args: AdminCartOrderNotificationArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderAdminCartOrderNotificationEmail(args)

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
