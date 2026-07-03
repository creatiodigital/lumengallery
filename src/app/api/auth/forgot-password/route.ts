import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

import prisma from '@/lib/prisma'
import { isEmail } from '@/lib/validation'
import { sendForgotPasswordEmail } from '@/lib/emails/forgotPassword'

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
    await sendForgotPasswordEmail({ to: email, name: user.name, resetUrl })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing forgot password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
