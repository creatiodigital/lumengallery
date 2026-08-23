import { Resend } from 'resend'

import { formatAmount } from './format'
import { escapeHtml } from '@/utils/escapeHtml'
import { emailDivider, emailEyebrow, emailHeading, emailNotice, emailParagraph } from './components'
import { renderEmailLayout } from './layout'
import { ADMIN_EMAIL_CC, ADMIN_EMAIL_TO } from './recipients'

const resend = new Resend(process.env.RESEND_API_KEY)

export type ExpiringAuthorization = {
  /** The 8-character reference shown on the order, every email and the invoice. */
  orderRef: string
  buyerName: string
  totalCents: number
  currency: string
  /** Whole days since the hold was taken. */
  days: number
  /** Whole days before Stripe voids it. 0 once past. */
  daysLeft: number
  /** True once the hold is past its expected lifetime. */
  lapsed: boolean
}

type Args = {
  orders: ExpiringAuthorization[]
  /** Absolute URL of /admin/orders, so the mail is one click from the work. */
  ordersUrl: string
}

/**
 * The daily "act on these before they lapse" note to the gallery admin.
 *
 * Deliberately NOT an adminCriticalAlert. That one shouts that the pipeline is
 * broken and something needs investigating; this is a routine morning nudge
 * about work that is going stale on its own. Dressing an ordinary reminder as
 * an incident is how an operator learns to skim past incidents.
 *
 * Pure renderer — no side effects, safe from the preview route.
 */
export function renderAuthorizationExpiryWarningEmail(args: Args): {
  subject: string
  html: string
} {
  const { orders, ordersUrl } = args
  const lapsed = orders.filter((o) => o.lapsed)
  const soon = orders.filter((o) => !o.lapsed)

  const atRiskCents = orders.reduce((sum, o) => sum + o.totalCents, 0)
  const currency = orders[0]?.currency ?? 'eur'

  const row = (o: ExpiringAuthorization) => {
    const when = o.lapsed
      ? '<span style="color:#b91c1c;font-weight:700">hold has lapsed</span>'
      : `<strong>${o.daysLeft} ${o.daysLeft === 1 ? 'day' : 'days'}</strong> left`
    return (
      `<tr>` +
      `<td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-family:monospace,'Courier New';font-size:13px;letter-spacing:0.04em">${escapeHtml(o.orderRef)}</td>` +
      `<td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-family:Lato,sans-serif;font-size:13px">${escapeHtml(o.buyerName)}</td>` +
      `<td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-family:Lato,sans-serif;font-size:13px;white-space:nowrap">${escapeHtml(formatAmount(o.totalCents, o.currency))}</td>` +
      `<td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-family:Lato,sans-serif;font-size:13px;white-space:nowrap">held ${o.days}d · ${when}</td>` +
      `</tr>`
    )
  }

  const table =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px">` +
    `<tr>` +
    ['Order', 'Buyer', 'Value', 'Authorization']
      .map(
        (h) =>
          `<th align="left" style="padding:0 12px 6px;font-family:Lato,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#666">${h}</th>`,
      )
      .join('') +
    `</tr>` +
    [...lapsed, ...soon].map(row).join('') +
    `</table>`

  const headline =
    orders.length === 1
      ? 'One order is about to lose its authorization'
      : `${orders.length} orders are about to lose their authorization`

  const body =
    emailEyebrow('Daily check') +
    emailHeading(headline) +
    emailParagraph(
      'We authorize the buyer at checkout and take the payment when the order is placed for production. ' +
        'That hold does not last forever — once it lapses the buyer is never charged, the order dies, and ' +
        'any numbered copy it held goes back on sale. Nothing tells you when it happens.',
    ) +
    (lapsed.length > 0
      ? emailNotice(
          'alert',
          `<strong>${lapsed.length} of these ${lapsed.length === 1 ? 'has' : 'have'} already lapsed.</strong> ` +
            'Capturing those will fail — cancel the order and ask the buyer to purchase again.',
        )
      : '') +
    table +
    emailParagraph(
      `<strong>${escapeHtml(formatAmount(atRiskCents, currency))}</strong> of sales is resting on these holds.`,
    ) +
    emailDivider() +
    emailParagraph(
      `<a href="${escapeHtml(ordersUrl)}" style="color:#111">Open the orders dashboard</a> and, for each one: ` +
        'capture the payment if you intend to fulfil it, or cancel it and tell the buyer. Both are better than ' +
        'letting it lapse quietly.',
    ) +
    emailParagraph(
      '<span style="color:#999;font-size:11px">Sent once a day by the order safety net, only when there is ' +
        'something to act on. A card hold lasts about 7 days; a PayPal one longer, so some of these have more ' +
        'time than stated.</span>',
    )

  const subject =
    lapsed.length > 0
      ? `${orders.length} order${orders.length === 1 ? '' : 's'} need attention — ${lapsed.length} authorization${lapsed.length === 1 ? '' : 's'} already lapsed`
      : `${orders.length} order${orders.length === 1 ? '' : 's'} to capture before the hold expires`

  return {
    subject,
    html: renderEmailLayout({ preheader: headline, bodyHtml: body }),
  }
}

/**
 * Send the daily warning. Never throws — a failure here must not take down the
 * reconcile cron, whose other phases repair real data.
 */
export async function sendAuthorizationExpiryWarning(
  args: Args,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }
  if (args.orders.length === 0) {
    // Silence is the correct output when nothing is at risk. A daily "all
    // clear" trains the reader to delete the one that matters unread.
    return { ok: true, id: 'nothing-to-report' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderAuthorizationExpiryWarningEmail(args)

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: ADMIN_EMAIL_TO,
      cc: ADMIN_EMAIL_CC,
      subject,
      html,
    })
    if (res.error) return { ok: false, error: res.error.message ?? 'resend error' }
    return { ok: true, id: res.data?.id ?? '' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
