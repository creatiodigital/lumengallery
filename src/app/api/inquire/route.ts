import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import { sanitizeLine, sanitizeMultiline } from '@/utils/sanitizeLine'
import { isEmail } from '@/lib/validation'

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)

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
    // Get client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

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

    // Now safe to escape for HTML email template interpolation.
    const safeFirstName = escapeHtml(firstName)
    const safeLastName = escapeHtml(lastName)
    const safeEmail = escapeHtml(email)
    const safePhone = escapeHtml(phone)
    const safeMessage = escapeHtml(message)
    const safeArtworkTitle = escapeHtml(artworkTitle)
    const safeArtworkArtist = escapeHtml(artworkArtist)
    const safeArtworkSlug = escapeHtml(artworkSlug)

    // Get environment variables
    const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
    const inquiryRecipientsEnv = process.env.INQUIRY_EMAIL_TO || 'contact@theartroom.gallery'
    // Support comma-separated emails for multiple recipients
    const inquiryRecipients = inquiryRecipientsEnv.split(',').map((e) => e.trim())

    // Send inquiry notification to admin
    await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: inquiryRecipients,
      replyTo: email,
      subject: `New Inquiry: ${safeArtworkTitle} by ${safeArtworkArtist}`,
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="font-size: 24px; margin-bottom: 24px;">New Artwork Inquiry</h2>
          
          <div style="background-color: #f9f9f9; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0;"><strong>Artwork:</strong> ${safeArtworkTitle}</p>
            <p style="margin: 0 0 8px 0;"><strong>Artist:</strong> ${safeArtworkArtist}</p>
            <p style="margin: 0;"><strong>Artwork Ref:</strong> ${safeArtworkSlug}</p>
          </div>
          
          <h3 style="font-size: 18px; margin-bottom: 16px;">Contact Information</h3>
          <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${safeFirstName} ${safeLastName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
          <p style="margin: 0 0 24px 0;"><strong>Phone:</strong> ${safePhone}</p>
          
          <h3 style="font-size: 18px; margin-bottom: 16px;">Message</h3>
          <div style="background-color: #f9f9f9; padding: 20px; white-space: pre-wrap;">${safeMessage}</div>
          
          <p style="margin-top: 32px; color: #666; font-size: 12px;">
            This inquiry was submitted via The Art Room website.
          </p>
        </div>
      `,
    })

    // Send confirmation to the user
    await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: email,
      subject: `We received your inquiry about "${safeArtworkTitle}"`,
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="font-size: 24px; margin-bottom: 24px;">Thank you for your inquiry</h2>
          
          <p>Dear ${safeFirstName},</p>
          
          <p>We have received your inquiry about <strong>${safeArtworkTitle}</strong> by ${safeArtworkArtist}.</p>
          
          <p>Our team will review your message and get back to you as soon as possible.</p>
          
          <div style="background-color: #f9f9f9; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Your message:</strong></p>
            <p style="margin: 0; white-space: pre-wrap;">${safeMessage}</p>
          </div>
          
          <p>Best regards,<br>The Art Room Team</p>
          
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;" />
          
          <p style="color: #666; font-size: 12px;">
            This is an automated confirmation. Please do not reply to this email.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing inquiry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
