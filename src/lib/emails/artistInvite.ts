import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailButton,
  emailCodeBlock,
  emailHeading,
  emailNotice,
  emailParagraph,
} from './components'
import { renderEmailLayout } from './layout'

const resend = new Resend(process.env.RESEND_API_KEY)

export type ArtistInviteArgs = {
  name: string
  email: string
  tempPassword: string
  loginUrl: string
}

/**
 * Pure renderer — builds the subject and HTML for the artist invite email.
 * No side effects; safe to call from preview routes.
 */
export function renderArtistInviteEmail(args: ArtistInviteArgs): { subject: string; html: string } {
  const safeName = escapeHtml(args.name)
  const safeEmail = escapeHtml(args.email)
  const safeTempPassword = escapeHtml(args.tempPassword)
  const safeLoginUrl = escapeHtml(args.loginUrl)

  const body =
    emailHeading('Welcome to The Art Room!') +
    emailParagraph(`Hi ${safeName},`) +
    emailParagraph(
      'You&rsquo;ve been invited to join The Art Room as an artist. Your account is ready and waiting for you.',
    ) +
    `<p style="margin:0 0 8px;font-family:Helvetica,'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:700;line-height:1.65;color:#111111">Your Login Details:</p>` +
    emailParagraph(`<strong>Email:</strong> ${safeEmail}`) +
    `<p style="margin:0 0 8px;font-family:Helvetica,'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.65;color:#333333"><strong>Temporary Password:</strong></p>` +
    emailCodeBlock(safeTempPassword) +
    emailNotice(
      'caution',
      '<strong>Important:</strong> You will be asked to set a new password when you first log in.',
    ) +
    emailButton('Go to your login page', safeLoginUrl) +
    emailParagraph(
      `<span style="color:#595959;font-size:13px">Your login page: <a href="${safeLoginUrl}" style="color:#595959;word-break:break-all">${safeLoginUrl}</a></span>`,
    )

  return {
    subject: "You've been invited to The Art Room",
    html: renderEmailLayout({
      preheader: "You've been invited to The Art Room as an artist",
      bodyHtml: body,
    }),
  }
}

/**
 * Sends the artist invite email via Resend.
 * Resolves with `{ ok: false }` on failure rather than throwing.
 */
export async function sendArtistInviteEmail(args: {
  to: string
  name: string
  email: string
  tempPassword: string
  loginUrl: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderArtistInviteEmail({
    name: args.name,
    email: args.email,
    tempPassword: args.tempPassword,
    loginUrl: args.loginUrl,
  })

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
