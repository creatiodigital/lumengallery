import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailDetailRows,
  emailHeading,
  emailParagraph,
} from './components'
import { formatAmount } from './format'
import { renderEmailLayout } from './layout'

const resend = new Resend(process.env.RESEND_API_KEY)

type ArtistPayoutArgs = {
  to: string
  artistFirstName: string
  artworkTitle: string
  amountCents: number
  currency: string
  transferId: string
}

/**
 * Pure renderer — builds the subject and HTML for the artist-payout email.
 * No side effects; safe to call from preview routes.
 */
export function renderArtistPayoutEmail(args: ArtistPayoutArgs): {
  subject: string
  html: string
} {
  const safeName = escapeHtml(args.artistFirstName || 'there')
  const safeArtwork = escapeHtml(args.artworkTitle)
  const amount = formatAmount(args.amountCents, args.currency)

  const body =
    emailHeading('You made a sale') +
    emailParagraph(`Hi ${safeName},`) +
    emailParagraph(
      `Someone bought a print of your work <strong>${safeArtwork}</strong>. The order has been produced, shipped and accepted &mdash; so we&rsquo;ve just released your share.`,
    ) +
    emailDetailRows([{ label: 'Your share', value: `<strong style="font-size:18px">${amount}</strong>` }]) +
    emailParagraph(
      `The money is on its way to your connected Stripe account. Stripe will pay it out to your bank on your usual payout schedule &mdash; you can check the status any time from your Stripe dashboard.`,
    ) +
    emailParagraph('Thanks for having your work on The Art Room.') +
    emailParagraph('<span style="color:#666;font-size:13px">&mdash; The Art Room</span>')

  return {
    subject: 'Someone bought your print — we’ve sent your share',
    html: renderEmailLayout({
      preheader: `Your share from the sale of “${args.artworkTitle}” has been released`,
      bodyHtml: body,
    }),
  }
}

/**
 * Sent to the artist when we release their payout — which is intentionally
 * the *only* moment they hear from us about a sale. We hold off through the
 * order/production/shipping/delivery window so the message is a real
 * confirmation, never a promise that might not land.
 *
 * Resolves with `{ ok: false }` on failure rather than throwing, so the
 * caller can log + continue without aborting the webhook.
 */
export async function sendArtistPayoutEmail(
  args: ArtistPayoutArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderArtistPayoutEmail(args)

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
