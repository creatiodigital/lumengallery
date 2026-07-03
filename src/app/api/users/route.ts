import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireAdminOrAbove, isSuperAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Admin-only: the sole consumer is the admin users dashboard (useUsers →
// AdminUsers). The select is a strict allowlist — the User row also carries
// password hashes, login OTP codes, and magic-link tokens, which must never
// leave the server no matter who asks.
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAdminOrAbove()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const featured = searchParams.get('featured')

    // Base filter
    const where: Record<string, unknown> = featured === 'true' ? { isFeatured: true } : {}

    // If user is admin (not superAdmin), show own account + non-admin users
    if (!isSuperAdmin(session!.user.userType)) {
      where.OR = [
        { id: session!.user.id }, // Always include own account
        { userType: { notIn: ['admin', 'superAdmin'] } }, // Plus all non-admin users
      ]
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        lastName: true,
        handler: true,
        biography: true,
        userType: true,
        email: true,
        profileImageUrl: true,
        isFeatured: true,
        published: true,
      },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('[GET /api/users] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
