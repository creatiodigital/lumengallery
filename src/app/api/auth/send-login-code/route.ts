import crypto from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import prisma from '@/lib/prisma'
import { getClientIp } from '@/lib/getClientIp'
import { rateLimit } from '@/lib/rateLimit'
import { sendLoginCodeEmail } from '@/lib/emails/loginCode'

// Generate a random 6-digit code. CSPRNG, not Math.random(): this code is a
// second factor, so its entropy must not be predictable from engine state.
function generateLoginCode(): string {
  return crypto.randomInt(100000, 1000000).toString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Rate limiting (durable, trusted x-real-ip not the spoofable first hop).
    const ip = getClientIp(request)
    const { success } = await rateLimit({
      name: 'send-login-code',
      key: ip,
      limit: 5,
      windowSeconds: 60,
    })
    if (!success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 },
      )
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || !user.password) {
      // Return generic error to prevent email enumeration
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // If user must change password (provisional login), skip OTP
    if (user.mustChangePassword) {
      return NextResponse.json({ success: true, mustChangePassword: true })
    }

    // Local-dev escape hatch: SKIP_LOGIN_OTP=true (only honoured outside
    // production) bypasses the verification step entirely. Returns the
    // same shape as `mustChangePassword`-flow so the login UI signs in
    // directly, no 6-digit prompt. Staging/production ignore this flag
    // because their NODE_ENV is "production".
    const skipOtp = process.env.NODE_ENV !== 'production' && process.env.SKIP_LOGIN_OTP === 'true'
    if (skipOtp) {
      // Clear any stale code so subsequent normal logins start fresh.
      await prisma.user.update({
        where: { id: user.id },
        data: { loginCode: null, loginCodeExpiry: null },
      })
      return NextResponse.json({ success: true, skipOtp: true })
    }

    // Generate 6-digit code with 10-minute expiry
    const loginCode = generateLoginCode()
    const loginCodeExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store code in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginCode,
        loginCodeExpiry,
      },
    })

    // Send code via email — unless `SKIP_LOGIN_EMAIL=true` is set in
    // a non-production environment. The flag is for local e2e testing
    // so the developer's inbox doesn't accumulate codes on every test
    // run. The code is still generated, stored, and validated by
    // NextAuth identically — only the delivery channel is suppressed.
    // The `NODE_ENV !== 'production'` guard means accidentally
    // setting this on Vercel has no effect.
    const skipEmail =
      process.env.NODE_ENV !== 'production' && process.env.SKIP_LOGIN_EMAIL === 'true'

    if (!skipEmail) {
      await sendLoginCodeEmail({ to: email, code: loginCode })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending login code:', error)
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 })
  }
}
