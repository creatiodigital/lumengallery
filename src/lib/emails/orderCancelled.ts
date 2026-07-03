import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailDetailRows,
  emailDivider,
  emailEyebrow,
  emailHeading,
  emailNotice,
  emailParagraph,
} from './components'
import { renderEmailLayout } from './layout'

const resend = new Resend(process.env.RESEND_API_KEY)

type PaymentState = 'authorized' | 'canceled' | 'succeeded' | 'refunded' | string

type OrderCancelledArgs = {
  to: string
  buyerName: string
  orderId: string
  artworkTitle: string
  artistName: string
  /** Current payment state — shapes the refund-language in the email. */
  paymentStatus: PaymentState
}

/**
 * Pure renderer — builds the subject and HTML for the order-cancelled email.
 * No side effects; safe to call from preview routes.
 *
 * Copy adapts to the current Stripe payment state so we never promise money
 * that isn't actually moving.
 */
export function renderOrderCancelledEmail(args: OrderCancelledArgs): {
  subject: string
  html: string
} {
  const rawFirstName = args.buyerName.split(' ')[0] || 'there'
  const firstName = escapeHtml(rawFirstName)
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeOrderId = escapeHtml(args.orderId.slice(0, 8))

  // What do we tell the buyer about the money? Preserve exact copy from the
  // original implementation — each branch maps to the same Stripe state.
  const moneyLine =
    args.paymentStatus === 'refunded'
      ? 'Your refund has already been issued and should appear on your statement within 5&ndash;10 business days.'
      : args.paymentStatus === 'succeeded'
        ? 'Your card was charged for this order &mdash; we&rsquo;re processing a full refund now. You&rsquo;ll get another email from us once it&rsquo;s issued; it typically appears on your statement within 5&ndash;10 business days.'
        : args.paymentStatus === 'authorized'
          ? 'The temporary hold we placed on your card will be released shortly &mdash; no money was charged.'
          : args.paymentStatus === 'canceled'
            ? 'The temporary hold on your card has been released &mdash; no money was charged.'
            : 'Our team will be in touch shortly about any money owed to you.'

  // Use 'alert' for the 'succeeded' branch (refund pending = real money movement
  // in progress — warrants a stronger callout). All other states are informational.
  const noticeVariant = args.paymentStatus === 'succeeded' ? 'alert' : 'info'

  const body =
    emailHeading(`We&rsquo;re sorry, ${firstName}`) +
    emailParagraph(
      'We&rsquo;re writing to let you know that your order has been canceled and will not be printed or shipped. We&rsquo;re sorry for the inconvenience.',
    ) +
    emailNotice(noticeVariant, moneyLine) +
    emailDivider() +
    emailEyebrow(`Order ${safeOrderId.toUpperCase()}`) +
    emailDetailRows([
      { label: 'Artwork', value: safeArtwork },
      { label: 'Artist', value: safeArtist },
    ]) +
    emailDivider() +
    emailParagraph(
      'If you have any questions or this was unexpected, just reply to this email and we&rsquo;ll get straight back to you.',
    ) +
    emailParagraph('&mdash; The Art Room')

  return {
    subject: 'Your order has been canceled',
    html: renderEmailLayout({ preheader: 'Your order has been canceled', bodyHtml: body }),
  }
}

/**
 * Sent to the buyer when an order transitions to our `Cancelled` stage,
 * by admin action. Copy adapts to the current Stripe payment state so we
 * never promise money that isn't actually moving.
 *
 * Resolves with `{ ok: false }` on failure rather than throwing, so the
 * caller can log + continue without aborting the webhook.
 */
export async function sendOrderCancelledEmail(
  args: OrderCancelledArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderOrderCancelledEmail(args)

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
