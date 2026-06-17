import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import crypto from 'crypto'

import { escapeHtml } from '@/utils/escapeHtml'
import prisma from '@/lib/prisma'
import { isEmail } from '@/lib/validation'

const resend = new Resend(process.env.RESEND_API_KEY)

// Rate limiting
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
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Email format validation
    if (!isEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Find user by email (don't reveal if email exists or not for security)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // For security, always return success even if user not found
    if (!user) {
      // Silent return — don't reveal whether email exists
      return NextResponse.json({ success: true })
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Store token in database (using magicLink fields)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        magicLinkToken: resetToken,
        magicLinkExpiry: tokenExpiry,
      },
    })

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://theartroom.gallery'
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`

    // Send reset email
    const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'

    await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: email,
      subject: 'Reset your password',
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="font-size: 24px; margin-bottom: 24px;">Reset Your Password</h2>
          
          <p>Hi ${escapeHtml(user.name)},</p>
          
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background-color: #000; color: #fff; text-decoration: none; font-size: 16px;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>
          
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;" />
          
          <p style="color: #666; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color: #666;">${resetUrl}</a>
          </p>
        </div>
      `,
    })

    // Password reset email sent

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing forgot password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
