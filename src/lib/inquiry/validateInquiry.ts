import { isEmail } from '@/lib/validation'
import { sanitizeLine, sanitizeMultiline } from '@/utils/sanitizeLine'

/**
 * Validate and normalise an inquiry submission.
 *
 * Extracted from the route so the rules are testable without sending mail — the
 * suite must never put a message through Resend, and the interesting cases here
 * are precisely the ones that used to end in an email.
 *
 * Two rules earn their place beyond ordinary shape-checking:
 *
 *  - The three artwork fields are capped. They were omitted from the original
 *    cap block while the other five were covered, and `artworkTitle` reaches the
 *    SUBJECT LINE of two separate emails, so an uncapped value was a way to push
 *    4,000+ characters into a header.
 *  - The honeypot is enforced HERE, server-side. It previously lived only in the
 *    React component, which returns early when the decoy is filled — real
 *    protection against a browser automating the form, none whatsoever against
 *    `curl`, which never runs that code.
 */

export type InquiryInput = {
  firstName: string
  lastName: string
  email: string
  phone: string
  message: string
  artworkSlug: string
  artworkTitle: string
  artworkArtist: string
}

export type InquiryValidation =
  | { ok: true; value: InquiryInput }
  /** `drop` means: answer as if it succeeded, but send nothing. */
  | { ok: false; drop: true }
  | { ok: false; drop?: false; status: number; error: string }

/** Single-line fields, with the cap each one is allowed. */
const LINE_LIMITS = {
  firstName: 100,
  lastName: 100,
  email: 200,
  phone: 32,
  // Previously uncapped, and this one reaches a Subject header.
  artworkSlug: 200,
  artworkTitle: 200,
  artworkArtist: 200,
} as const

const MESSAGE_LIMIT = 4000

/** Fields a person must actually fill in. */
const REQUIRED = ['firstName', 'lastName', 'email', 'phone', 'message'] as const

export function validateInquiry(body: Record<string, unknown>): InquiryValidation {
  // The decoy is invisible and tab-skipped, so a human never fills it. Checked
  // before anything else: a bot's submission should cost us no further work.
  // Silently dropped rather than rejected — a 400 here just teaches the next
  // attempt which field to leave alone.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return { ok: false, drop: true }
  }

  for (const field of REQUIRED) {
    if (typeof body[field] !== 'string') {
      return { ok: false, status: 400, error: 'Invalid request.' }
    }
  }

  // Sanitize BEFORE measuring, so a payload padded with control characters
  // cannot slip past on raw byte count.
  const value: InquiryInput = {
    firstName: sanitizeLine(body.firstName as string),
    lastName: sanitizeLine(body.lastName as string),
    email: sanitizeLine(body.email as string),
    phone: sanitizeLine(body.phone as string),
    message: sanitizeMultiline(body.message as string),
    artworkSlug: typeof body.artworkSlug === 'string' ? sanitizeLine(body.artworkSlug) : '',
    artworkTitle: typeof body.artworkTitle === 'string' ? sanitizeLine(body.artworkTitle) : '',
    artworkArtist: typeof body.artworkArtist === 'string' ? sanitizeLine(body.artworkArtist) : '',
  }

  for (const [field, limit] of Object.entries(LINE_LIMITS)) {
    if (value[field as keyof typeof LINE_LIMITS].length > limit) {
      return { ok: false, status: 400, error: 'Input too long.' }
    }
  }
  if (value.message.length > MESSAGE_LIMIT) {
    return { ok: false, status: 400, error: 'Input too long.' }
  }

  // Presence checked after sanitizing: a whitespace-only value smuggled past the
  // client's `required` attribute is empty by the time it matters.
  for (const field of REQUIRED) {
    if (!value[field]) {
      return { ok: false, status: 400, error: 'All fields are required.' }
    }
  }

  // Format checked after sanitizing, so smuggled CRLF cannot reach a header.
  if (!isEmail(value.email)) {
    return { ok: false, status: 400, error: 'Invalid email format' }
  }

  return { ok: true, value }
}
