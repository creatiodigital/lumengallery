import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import { emailCodeBlock, emailHeading, emailParagraph } from './components'
import { renderEmailLayout } from './layout'

const resend = new Resend(process.env.RESEND_API_KEY)

export type LoginCodeArgs = {
  code: string
}

/**
 * Pure renderer — builds the subject and HTML for the login verification code email.
 * No side effects; safe to call from preview routes.
 */
export function renderLoginCodeEmail(args: LoginCodeArgs): { subject: string; html: string } {
  const safeCode = escapeHtml(args.code)

  const body =
    emailHeading('Your login verification code') +
    emailParagraph('Your login verification code is:') +
    emailCodeBlock(safeCode) +
    emailParagraph(
      '<span style="color:#595959;font-size:13px">This code will expire in 10 minutes.</span>',
    ) +
    emailParagraph(
      '<span style="color:#595959;font-size:13px">If you didn&rsquo;t request this, please ignore this email.</span>',
    )

  return {
    subject: 'Your login verification code',
    html: renderEmailLayout({
      preheader: 'Your login verification code for The Art Room',
      bodyHtml: body,
    }),
  }
}

/**
 * Sends the login verification code email via Resend.
 * Resolves with `{ ok: false }` on failure rather than throwing.
 */
export async function sendLoginCodeEmail(args: {
  to: string
  code: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderLoginCodeEmail({ code: args.code })

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
