import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailDivider,
  emailHeading,
  emailNotice,
  emailParagraph,
} from './components'
import { renderEmailLayout } from './layout'

const resend = new Resend(process.env.RESEND_API_KEY)

export type InquiryUserConfirmationArgs = {
  firstName: string
  email: string
  message: string
  artworkTitle: string
  artworkArtist: string
}

/**
 * Pure renderer — builds the subject and HTML for the buyer inquiry auto-reply.
 * No side effects; safe to call from preview routes.
 */
export function renderInquiryUserConfirmationEmail(
  args: InquiryUserConfirmationArgs,
): { subject: string; html: string } {
  const safeFirstName = escapeHtml(args.firstName)
  const safeArtworkTitle = escapeHtml(args.artworkTitle)
  const safeArtworkArtist = escapeHtml(args.artworkArtist)

  // Preserve line breaks in the echoed message.
  const safeMessage = escapeHtml(args.message).replace(/\n/g, '<br>')

  const body =
    emailHeading('Thank you for your inquiry') +
    emailParagraph(`Dear ${safeFirstName},`) +
    emailParagraph(
      `We have received your inquiry about <strong>${safeArtworkTitle}</strong> by ${safeArtworkArtist}.`,
    ) +
    emailParagraph('Our team will review your message and get back to you as soon as possible.') +
    emailNotice('info', `<strong>Your message:</strong><br>${safeMessage}`) +
    emailDivider() +
    emailParagraph(
      'Best regards,<br>The Art Room Team',
    ) +
    emailParagraph(
      '<span style="color:#888888;font-size:12px">This is an automated confirmation. Please do not reply to this email.</span>',
    )

  return {
    subject: `We received your inquiry about "${args.artworkTitle}"`,
    html: renderEmailLayout({
      preheader: `We received your inquiry about ${args.artworkTitle}`,
      bodyHtml: body,
    }),
  }
}

/**
 * Sends the user inquiry confirmation email to the enquirer.
 *
 * Resolves with `{ ok: false }` on failure rather than throwing.
 */
export async function sendInquiryUserConfirmationEmail(
  args: InquiryUserConfirmationArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderInquiryUserConfirmationEmail(args)

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: args.email,
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
