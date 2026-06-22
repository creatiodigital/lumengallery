import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import { emailButton, emailDivider, emailHeading, emailParagraph } from './components'
import { renderEmailLayout } from './layout'

const resend = new Resend(process.env.RESEND_API_KEY)

export type ForgotPasswordArgs = {
  name: string
  resetUrl: string
}

/**
 * Pure renderer — builds the subject and HTML for the password reset email.
 * No side effects; safe to call from preview routes.
 */
export function renderForgotPasswordEmail(args: ForgotPasswordArgs): {
  subject: string
  html: string
} {
  const safeName = escapeHtml(args.name)
  const safeResetUrl = escapeHtml(args.resetUrl)

  const body =
    emailHeading('Reset Your Password') +
    emailParagraph(`Hi ${safeName},`) +
    emailParagraph('We received a request to reset your password. Click the button below to create a new password:') +
    emailButton('Reset password', safeResetUrl) +
    emailParagraph(
      '<span style="color:#595959;font-size:13px">This link will expire in 1 hour. If you didn&rsquo;t request this, you can safely ignore this email.</span>',
    ) +
    emailDivider() +
    emailParagraph(
      `<span style="color:#595959;font-size:13px">If the button doesn&rsquo;t work, copy and paste this link into your browser:<br><a href="${safeResetUrl}" style="color:#595959;word-break:break-all">${safeResetUrl}</a></span>`,
    )

  return {
    subject: 'Reset your password',
    html: renderEmailLayout({
      preheader: 'Reset your password for The Art Room',
      bodyHtml: body,
    }),
  }
}

/**
 * Sends the password reset email via Resend.
 * Resolves with `{ ok: false }` on failure rather than throwing.
 */
export async function sendForgotPasswordEmail(args: {
  to: string
  name: string
  resetUrl: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderForgotPasswordEmail({ name: args.name, resetUrl: args.resetUrl })

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
