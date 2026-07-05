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

export type InquiryAdminNotificationArgs = {
  firstName: string
  lastName: string
  email: string
  phone: string
  message: string
  artworkTitle: string
  artworkArtist: string
  artworkSlug?: string
}

/**
 * Pure renderer — builds the subject and HTML for the admin inquiry notification.
 * No side effects; safe to call from preview routes.
 */
export function renderInquiryAdminNotificationEmail(args: InquiryAdminNotificationArgs): {
  subject: string
  html: string
} {
  const safeFirstName = escapeHtml(args.firstName)
  const safeLastName = escapeHtml(args.lastName)
  const safeEmail = escapeHtml(args.email)
  const safePhone = escapeHtml(args.phone)
  const safeArtworkTitle = escapeHtml(args.artworkTitle)
  const safeArtworkArtist = escapeHtml(args.artworkArtist)
  const safeArtworkSlug = escapeHtml(args.artworkSlug ?? '')

  // Preserve line breaks in the message body.
  const safeMessage = escapeHtml(args.message).replace(/\n/g, '<br>')

  const artworkRows = [
    { label: 'Artwork', value: safeArtworkTitle },
    { label: 'Artist', value: safeArtworkArtist },
    ...(safeArtworkSlug ? [{ label: 'Artwork Ref', value: safeArtworkSlug }] : []),
  ]

  const contactRows = [
    { label: 'Name', value: `${safeFirstName} ${safeLastName}` },
    {
      label: 'Email',
      value: `<a href="mailto:${safeEmail}" style="color:inherit">${safeEmail}</a>`,
    },
    { label: 'Phone', value: safePhone },
  ]

  const body =
    emailHeading('New Artwork Inquiry') +
    emailEyebrow('Artwork') +
    emailDetailRows(artworkRows) +
    emailDivider() +
    emailEyebrow('Contact Information') +
    emailDetailRows(contactRows) +
    emailDivider() +
    emailEyebrow('Message') +
    emailNotice('info', safeMessage) +
    emailParagraph(
      '<span style="color:#888888;font-size:12px">This inquiry was submitted via The Art Room website.</span>',
    )

  return {
    subject: `New Inquiry: ${args.artworkTitle} by ${args.artworkArtist}`,
    html: renderEmailLayout({
      preheader: `New inquiry about ${args.artworkTitle} by ${args.artworkArtist}`,
      bodyHtml: body,
    }),
  }
}

/**
 * Sends the admin inquiry notification email.
 * Recipients are parsed from the INQUIRY_EMAIL_TO env var (comma-separated).
 * replyTo is set to the inquirer's email so the team can reply directly.
 *
 * Resolves with `{ ok: false }` on failure rather than throwing.
 */
export async function sendInquiryAdminNotificationEmail(
  args: InquiryAdminNotificationArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const inquiryRecipientsEnv = process.env.INQUIRY_EMAIL_TO || 'contact@theartroom.gallery'
  const inquiryRecipients = inquiryRecipientsEnv.split(',').map((e) => e.trim())

  const { subject, html } = renderInquiryAdminNotificationEmail(args)

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: inquiryRecipients,
      replyTo: args.email,
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
