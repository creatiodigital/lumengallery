import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'

const resend = new Resend(process.env.RESEND_API_KEY)

export const ADMIN_ORDER_NOTIFICATION_TO = 'contact@theartroom.gallery'
export const ADMIN_ORDER_NOTIFICATION_CC = 'contact@creatio.art'

function formatAmount(cents: number, currency: string): string {
  const symbol = currency.toLowerCase() === 'eur' ? '€' : currency.toUpperCase() + ' '
  return `${symbol}${(cents / 100).toFixed(2)}`
}

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
 * Alert the gallery admin when an order is cancelled. Fires on
 * admin-initiated rejections — TPS doesn't expose a sync API, so
 * admin owns the cancellation flow.
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

  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeBuyerName = escapeHtml(args.buyerName || '—')
  const safeBuyerEmail = escapeHtml(args.buyerEmail || '—')
  const safeOrderIdShort = escapeHtml(args.orderId.slice(0, 8))
  const safeAdminUrl = escapeHtml(args.adminOrderUrl)
  const total = formatAmount(args.totalCents, args.currency)

  const sourceLine = 'You cancelled this order from the admin dashboard.'

  const refundNeeded = args.paymentStatus === 'succeeded'
  const moneyLine = refundNeeded
    ? `⚠️ <strong>Refund is required</strong> — the buyer&rsquo;s card was already charged ${total}. Click <a href="${safeAdminUrl}">Open in admin</a> and use the Refund buyer button.`
    : args.paymentStatus === 'authorized'
      ? `The Stripe auth is still open. Consider voiding it via the Mark rejected button to release the hold on the buyer&rsquo;s card.`
      : args.paymentStatus === 'canceled'
        ? `Stripe auth has been voided already — no further action needed on the money side.`
        : args.paymentStatus === 'refunded'
          ? `Refund already issued — no further action needed on the money side.`
          : `Payment state: <code>${escapeHtml(args.paymentStatus)}</code> — review in the admin dashboard.`

  try {
    const res = await resend.emails.send({
      from: `The Art Room Orders <${fromEmail}>`,
      to: ADMIN_ORDER_NOTIFICATION_TO,
      cc: ADMIN_ORDER_NOTIFICATION_CC,
      subject: `Order #${safeOrderIdShort} cancelled — ${args.artworkTitle}${refundNeeded ? ' — REFUND NEEDED' : ''}`,
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 640px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 20px; margin: 0 0 8px 0;">Order cancelled</h2>
          <p style="margin: 0 0 20px 0; color:#666;">Order #${safeOrderIdShort} · ${total}</p>

          <p style="margin: 0 0 16px 0;">${sourceLine}</p>

          <p style="margin: 0 0 20px 0;">
            <a href="${safeAdminUrl}" style="background:#111;color:#fff;padding:10px 16px;text-decoration:none;display:inline-block;">Open in admin</a>
          </p>

          <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#666;margin:24px 0 8px 0;">Money</h3>
          <p style="margin:0 0 8px 0; padding:10px 14px; background:${refundNeeded ? '#fdecea' : '#f6f6f6'}; border:1px solid ${refundNeeded ? '#f5a5a0' : 'transparent'}; border-radius:3px;">
            ${moneyLine}
          </p>

          <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#666;margin:24px 0 8px 0;">Order</h3>
          <p style="margin:0 0 4px 0;"><strong>${safeArtwork}</strong> — ${safeArtist}</p>
          <p style="margin:0 0 4px 0;">Buyer: ${safeBuyerName} · ${safeBuyerEmail}</p>
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
