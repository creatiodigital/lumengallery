import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import prisma from '@/lib/prisma'
import { getClientIp } from '@/lib/getClientIp'
import { rateLimit } from '@/lib/rateLimit'
import { MAX_LENGTHS, tooLong } from '@/lib/validation'
import { validatePassword } from '@/utils/password'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (durable, trusted x-real-ip not the spoofable first hop).
    // Without this the reset token — the one credential that hands over an
    // account outright — could be guessed without limit. Matched to
    // forgot-password, which is what issues the tokens in the first place.
    const ip = getClientIp(request)
    const { success } = await rateLimit({
      name: 'reset-password',
      key: ip,
      limit: 5,
      windowSeconds: 60,
    })
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }

    // Reject oversized input before the token lookup and bcrypt.hash.
    if (tooLong(token, MAX_LENGTHS.token) || tooLong(password, MAX_LENGTHS.password)) {
      return NextResponse.json({ error: 'Invalid token or password' }, { status: 400 })
    }

    // Password validation
    const validation = validatePassword(password)
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Password must have ${validation.errors.join(', ')}` },
        { status: 400 },
      )
    }

    // Find user by reset token
    const user = await prisma.user.findFirst({
      where: {
        magicLinkToken: token,
        magicLinkExpiry: {
          gt: new Date(), // Token must not be expired
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 },
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        magicLinkToken: null,
        magicLinkExpiry: null,
      },
    })

    // Password reset successful

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
