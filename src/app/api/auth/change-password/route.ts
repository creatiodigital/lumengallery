import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { MAX_LENGTHS, tooLong } from '@/lib/validation'
import { validatePassword } from '@/utils/password'

export async function POST(request: NextRequest) {
  try {
    // Require authenticated session
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { newPassword, currentPassword } = body

    if (!newPassword) {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 })
    }

    // Cap both before validation and bcrypt. `validatePassword` enforces the
    // same ceiling, but currentPassword never reaches it and is hashed too.
    if (
      tooLong(newPassword, MAX_LENGTHS.password) ||
      tooLong(currentPassword, MAX_LENGTHS.password)
    ) {
      return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
    }

    // Validate password requirements
    const validation = validatePassword(newPassword)
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Password must have ${validation.errors.join(', ')}` },
        { status: 400 },
      )
    }

    // Load the account to decide whether re-auth is required. The
    // `mustChangePassword` provisional first-login flow is the ONLY path
    // allowed to set a password without proving the current one — and it's
    // read from the DB, never trusted from the session claim.
    const account = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true, mustChangePassword: true },
    })
    if (!account) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Re-authentication: a normal password change must prove knowledge of the
    // current password. Without this, any live session (unlocked device,
    // stolen/replayed cookie) could silently seize the account permanently.
    if (!account.mustChangePassword) {
      if (!currentPassword || !account.password) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
      }
      const currentMatches = await bcrypt.compare(currentPassword, account.password)
      if (!currentMatches) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password and clear mustChangePassword flag
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    })

    // Password changed successfully

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
}
