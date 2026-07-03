import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailButton,
  emailDetailRows,
  emailHeading,
  emailNotice,
  emailParagraph,
} from './components'
import { renderEmailLayout } from './layout'
import { ADMIN_EMAIL_CC, ADMIN_EMAIL_TO } from './recipients'

const resend = new Resend(process.env.RESEND_API_KEY)

type CriticalAlertArgs = {
  /** Short headline shown in the email subject and big H2. */
  title: string
  /** What broke, in plain English. Include the error message verbatim. */
  problem: string
  /** Stripe PaymentIntent id, when known. Surfaces a deep link to the
   *  Stripe dashboard so the admin can confirm the buyer's auth state. */
  paymentIntentId?: string | null
  /** Free-form key/value context (artwork id, error stack, etc.). */
  context?: Record<string, string | number | null | undefined>
  /** Concrete next steps for the admin to recover. */
  whatToDo: string[]
}

/**
 * Pure renderer — builds the subject and HTML for the admin critical-alert
 * email. No side effects; safe to call from preview routes.
 */
export function renderAdminCriticalAlertEmail(args: CriticalAlertArgs): {
  subject: string
  html: string
} {
  const safeTitle = escapeHtml(args.title)
  const safeProblem = escapeHtml(args.problem)
  const safePI = args.paymentIntentId ? escapeHtml(args.paymentIntentId) : null
  const stripeUrl = safePI ? `https://dashboard.stripe.com/payments/${safePI}` : null

  const contextRows = args.context
    ? Object.entries(args.context)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => ({ label: escapeHtml(k), value: escapeHtml(String(v)) }))
    : []

  const todoItems = args.whatToDo
    .map((step) => `<li style="margin:0 0 6px 0;">${escapeHtml(step)}</li>`)
    .join('')

  const body =
    emailHeading(`🚨 ${safeTitle}`) +
    emailNotice(
      'alert',
      'A buyer may have paid (or had their card authorized) without a corresponding order row. <strong>Investigate immediately.</strong>',
    ) +
    `<p style="margin:0 0 8px;font-family:Lato,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#666">What broke</p>` +
    `<div style="margin:0 0 16px;padding:12px 14px;font-family:monospace,'Courier New';white-space:pre-wrap;font-size:12px;background:#f5f5f5;border:1px solid #d0d0d0">${safeProblem}</div>` +
    (stripeUrl ? emailButton('Open PaymentIntent in Stripe', stripeUrl) : '') +
    (contextRows.length ? emailDetailRows(contextRows) : '') +
    `<p style="margin:0 0 8px;font-family:Lato,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#666">What to do</p>` +
    `<ol style="margin:0 0 16px;padding-left:20px;font-family:Lato,sans-serif;font-size:14px;line-height:1.65;color:#333">${todoItems}</ol>` +
    emailParagraph(
      '<span style="color:#999;font-size:11px">Sent by the order-pipeline safety net. If you\'re seeing this it means the normal admin order email did not fire.</span>',
    )

  return {
    subject: `🚨 ORDER PIPELINE ALERT — ${args.title}`,
    html: renderEmailLayout({
      preheader: `🚨 ORDER PIPELINE ALERT — ${args.title}`,
      bodyHtml: body,
    }),
  }
}

/**
 * Last-resort alert for the gallery admin when the order pipeline fails
 * in a way that could leave a buyer's card authorized with no PrintOrder
 * row to act on (i.e. money held, no admin visibility). Sends to the
 * standard admin alias + cc, with a loud subject line so it sorts to the
 * top of the inbox.
 *
 * Never throws — failures here would create a meta-incident. Returns
 * `{ ok: false }` so the caller can record the email-send failure in the
 * order event log if an order id is available.
 */
export async function sendAdminCriticalAlert(
  args: CriticalAlertArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderAdminCriticalAlertEmail(args)

  try {
    const res = await resend.emails.send({
      from: `The Art Room Alerts <${fromEmail}>`,
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
