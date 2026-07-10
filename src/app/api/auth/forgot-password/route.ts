import { NextRequest, NextResponse, after } from 'next/server'
import crypto from 'crypto'

import prisma from '@/lib/prisma'
import { isEmail } from '@/lib/validation'
import { getClientIp } from '@/lib/getClientIp'
import { rateLimit } from '@/lib/rateLimit'
import { sendForgotPasswordEmail } from '@/lib/emails/forgotPassword'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (durable, trusted x-real-ip not the spoofable first hop).
    const ip = getClientIp(request)
    const { success } = await rateLimit({
      name: 'forgot-password',
      key: ip,
      limit: 3,
      windowSeconds: 60,
    })
    if (!success) {
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

    // Send the reset email AFTER the response. Awaiting the provider
    // round-trip only for existing accounts makes the response measurably
    // slower for real users than for unknown emails — a timing oracle for
    // account existence. `after()` defers the send past the response (so the
    // client-observed latency matches the unknown-email branch) while the
    // platform keeps the function alive to actually deliver it — unlike a bare
    // fire-and-forget, which a serverless runtime may freeze before it sends.
    after(async () => {
      try {
        await sendForgotPasswordEmail({ to: email, name: user.name, resetUrl })
      } catch (err) {
        console.error('Error sending forgot-password email:', err)
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing forgot password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
