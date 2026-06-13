import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'

const resend = new Resend(process.env.RESEND_API_KEY)

export const ADMIN_CART_ORDER_NOTIFICATION_TO = 'contact@theartroom.gallery'
export const ADMIN_CART_ORDER_NOTIFICATION_CC = 'contact@creatio.art'

function formatAmount(cents: number, currency: string): string {
  const symbol = currency.toLowerCase() === 'eur' ? '€' : currency.toUpperCase() + ' '
  return `${symbol}${(cents / 100).toFixed(2)}`
}

type ShippingAddress = {
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
}

/** One purchased line, with the specs the admin pastes into TPS. */
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
 * Multi-item (cart) variant of {@link sendAdminOrderNotification}. Sent to
 * the gallery admin every time a cart order's card authorization succeeds.
 * Lists EVERY line item with its own specs so the admin can place each on
 * theprintspace's portal by hand (manual fulfillment mode).
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

  const safeBuyerName = escapeHtml(args.buyerName || '—')
  const safeBuyerEmail = escapeHtml(args.buyerEmail || '—')
  const safeOrderIdShort = escapeHtml(args.orderId.slice(0, 8))
  const safeOrderIdFull = escapeHtml(args.orderId)
  const safeAdminUrl = escapeHtml(args.adminOrderUrl)
  const total = formatAmount(args.totalCents, args.currency)
  const lineCount = args.lines.length

  const addr = args.shippingAddress
  const addrLines = [
    escapeHtml(addr.line1),
    addr.line2 ? escapeHtml(addr.line2) : null,
    `${escapeHtml(addr.postalCode)} ${escapeHtml(addr.city)}${addr.state ? ', ' + escapeHtml(addr.state) : ''}`,
    escapeHtml(addr.country),
  ].filter(Boolean)

  const lineBlocks = args.lines
    .map((line, i) => {
      const attrRows = Object.entries(line.skuAttributes)
        .map(
          ([k, v]) =>
            `<tr><td style="padding:2px 12px 2px 0;color:#666;">${escapeHtml(k)}</td><td style="padding:2px 0;">${escapeHtml(v)}</td></tr>`,
        )
        .join('')
      const qty = line.quantity > 1 ? ` &times;${line.quantity}` : ''
      return `
        <div style="border-top:1px solid #eee;padding-top:16px;margin-top:16px;">
          <p style="margin:0 0 4px 0;color:#999;font-size:12px;">Item ${i + 1} of ${lineCount}</p>
          <p style="margin:0 0 8px 0;"><strong>${escapeHtml(line.artworkTitle)}</strong> — ${escapeHtml(line.artistName)}${qty}</p>
          <table style="border-collapse:collapse;font-size:14px;">${attrRows}</table>
        </div>
      `
    })
    .join('')

  try {
    const res = await resend.emails.send({
      from: `The Art Room Orders <${fromEmail}>`,
      to: ADMIN_CART_ORDER_NOTIFICATION_TO,
      cc: ADMIN_CART_ORDER_NOTIFICATION_CC,
      subject: `New cart order #${args.orderId.slice(0, 8)} — ${lineCount} item(s) — needs placement at TPS`,
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 640px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 20px; margin: 0 0 8px 0;">New cart order — needs placement at TPS</h2>
          <p style="margin: 0 0 20px 0; color:#666;">Order #${safeOrderIdShort} · ${lineCount} item(s) · ${total}</p>

          <p style="margin: 0 0 20px 0;">
            <a href="${safeAdminUrl}" style="background:#111;color:#fff;padding:10px 16px;text-decoration:none;display:inline-block;">Open in admin</a>
          </p>

          <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#666;margin:24px 0 8px 0;">Items</h3>
          ${lineBlocks}

          <p style="margin:20px 0 0 0;font-size:13px;color:#666;">
            The print assets are available in the admin order page above. They are
            never linked from email — the original artwork is sale-sensitive content.
          </p>

          <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#666;margin:24px 0 8px 0;">Recipient</h3>
          <p style="margin:0 0 2px 0;">${safeBuyerName}</p>
          <p style="margin:0 0 2px 0;">${safeBuyerEmail}</p>
          ${addr.phone ? `<p style="margin:0 0 2px 0;">${escapeHtml(addr.phone)}</p>` : ''}
          ${addrLines.map((l) => `<p style="margin:0 0 2px 0;">${l}</p>`).join('')}

          <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#666;margin:24px 0 8px 0;">Shipping method</h3>
          <p style="margin:0;">Standard</p>

          <p style="margin: 32px 0 0 0; color:#666; font-size: 12px;">
            Order ID: <span style="font-family:monospace;">${safeOrderIdFull}</span>
          </p>
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
