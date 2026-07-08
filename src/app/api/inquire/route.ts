import { NextRequest, NextResponse } from 'next/server'

import { sanitizeLine, sanitizeMultiline } from '@/utils/sanitizeLine'
import { isEmail } from '@/lib/validation'
import { getClientIp } from '@/lib/getClientIp'
import { sendInquiryAdminNotificationEmail } from '@/lib/emails/inquiryAdminNotification'
import { sendInquiryUserConfirmationEmail } from '@/lib/emails/inquiryUserConfirmation'

// Rate limiting - simple in-memory store (resets on redeploy)
const rateLimitStore = new Map<string, { count: number; timestamp: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 3 // Max 3 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { count: 1, timestamp: now })
    return false
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return true
  }

  record.count++
  return false
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting (trusted x-real-ip, not the spoofable
    // first x-forwarded-for hop).
    const ip = getClientIp(request)

    // Check rate limit
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      )
    }

    const body = await request.json()

    const rawFirstName = body.firstName
    const rawLastName = body.lastName
    const rawEmail = body.email
    const rawPhone = body.phone
    const rawMessage = body.message
    const rawArtworkSlug = body.artworkSlug
    const rawArtworkTitle = body.artworkTitle
    const rawArtworkArtist = body.artworkArtist

    if (
      typeof rawFirstName !== 'string' ||
      typeof rawLastName !== 'string' ||
      typeof rawEmail !== 'string' ||
      typeof rawPhone !== 'string' ||
      typeof rawMessage !== 'string'
    ) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Strip control chars / zero-width Unicode and trim. Single-line
    // fields use sanitizeLine; the free-form message preserves newlines
    // via sanitizeMultiline so the admin email can render paragraphs.
    const firstName = sanitizeLine(rawFirstName)
    const lastName = sanitizeLine(rawLastName)
    const email = sanitizeLine(rawEmail)
    const phone = sanitizeLine(rawPhone)
    const message = sanitizeMultiline(rawMessage)
    const artworkSlug = typeof rawArtworkSlug === 'string' ? sanitizeLine(rawArtworkSlug) : ''
    const artworkTitle = typeof rawArtworkTitle === 'string' ? sanitizeLine(rawArtworkTitle) : ''
    const artworkArtist = typeof rawArtworkArtist === 'string' ? sanitizeLine(rawArtworkArtist) : ''

    // Length caps after sanitization (a tampered payload padded with
    // control chars can't sneak past via raw byte count this way).
    if (
      firstName.length > 100 ||
      lastName.length > 100 ||
      email.length > 200 ||
      phone.length > 32 ||
      message.length > 4000
    ) {
      return NextResponse.json({ error: 'Input too long.' }, { status: 400 })
    }

    // Required-field presence check post-sanitize (a pure-whitespace
    // input that the client smuggled past `required` is rejected here).
    if (!firstName || !lastName || !email || !phone || !message) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    // Email format validation — checked AFTER sanitization so smuggled
    // CRLF can't slip into header injection.
    if (!isEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Delegate to branded email modules — they handle FROM, recipients,
    // replyTo, escaping, and Resend. Sanitized (not yet escaped) values are
    // passed; each renderer escapes internally.
    await sendInquiryAdminNotificationEmail({
      firstName,
      lastName,
      email,
      phone,
      message,
      artworkTitle,
      artworkArtist,
      artworkSlug,
    })

    await sendInquiryUserConfirmationEmail({
      firstName,
      email,
      message,
      artworkTitle,
      artworkArtist,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing inquiry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
