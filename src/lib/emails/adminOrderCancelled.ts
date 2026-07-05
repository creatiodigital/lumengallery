import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailButton,
  emailDetailRows,
  emailDivider,
  emailEyebrow,
  emailNotice,
  emailParagraph,
} from './components'
import { formatAmount } from './format'
import { renderEmailLayout } from './layout'
import { ADMIN_EMAIL_TO, ADMIN_EMAIL_CC } from './recipients'

const resend = new Resend(process.env.RESEND_API_KEY)

type AdminOrderCancelledArgs = {
  orderId: string
  artworkTitle: string
  artistName: string
  buyerName: string
  buyerEmail: string
  paymentStatus: string
  totalCents: number
  currency: string
  adminOrderUrl: string
}

/**
 * Pure renderer — builds the subject and HTML for the admin order cancelled email.
 * No side effects; safe to call from preview routes.
 */
export function renderAdminOrderCancelledEmail(args: AdminOrderCancelledArgs): {
  subject: string
  html: string
} {
  const id8 = args.orderId.slice(0, 8).toUpperCase()
  const safeId8 = escapeHtml(id8)
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeBuyerName = escapeHtml(args.buyerName || '—')
  const safeBuyerEmail = escapeHtml(args.buyerEmail || '—')
  const safeAdminUrl = escapeHtml(args.adminOrderUrl)
  const total = formatAmount(args.totalCents, args.currency)

  const refundNeeded = args.paymentStatus === 'succeeded'

  const moneyNoticeHtml = refundNeeded
    ? `<strong>REFUND NEEDED</strong> &mdash; the buyer&rsquo;s card was already charged ${total}. Open the order in admin and use the Refund buyer button.`
    : args.paymentStatus === 'authorized'
      ? `The Stripe auth is still open. Consider voiding it via the Mark rejected button to release the hold on the buyer&rsquo;s card.`
      : args.paymentStatus === 'canceled'
        ? `Stripe auth has been voided already &mdash; no further action needed on the money side.`
        : args.paymentStatus === 'refunded'
          ? `Refund already issued &mdash; no further action needed on the money side.`
          : `Payment state: <code>${escapeHtml(args.paymentStatus)}</code> &mdash; review in the admin dashboard.`

  const body =
    emailEyebrow(`Order #${safeId8}`) +
    `<h2 style="margin:0 0 12px;font-size:18px;font-weight:700;line-height:1.3;color:#111111">Order canceled</h2>` +
    emailParagraph('You canceled this order from the admin dashboard.') +
    emailButton('Open in admin', safeAdminUrl) +
    emailDivider() +
    (refundNeeded ? emailNotice('alert', moneyNoticeHtml) : emailNotice('info', moneyNoticeHtml)) +
    emailDivider() +
    emailEyebrow('Order') +
    emailDetailRows([
      { label: 'Artwork', value: safeArtwork },
      { label: 'Artist', value: safeArtist },
      { label: 'Buyer', value: safeBuyerName },
      { label: 'Email', value: safeBuyerEmail },
      { label: 'Total', value: total },
    ])

  return {
    subject: `Order #${id8} canceled — ${args.artworkTitle}${refundNeeded ? ' — REFUND NEEDED' : ''}`,
    html: renderEmailLayout({
      preheader: `Order #${id8} canceled — ${args.artworkTitle}`,
      bodyHtml: body,
    }),
  }
}

/**
 * Alert the gallery admin when an order is canceled. Fires on
 * admin-initiated rejections — the fulfillment portal doesn't expose a sync API,
 * so admin owns the cancellation flow.
 *
 * Key signal: whether a refund is still owed to the buyer.
 */
export async function sendAdminOrderCancelledAlert(
  args: AdminOrderCancelledArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderAdminOrderCancelledEmail(args)

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
