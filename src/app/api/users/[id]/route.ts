import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'

import type { Prisma } from '@/generated/prisma'
import { UserType as UserTypeEnum } from '@/generated/prisma'
import {
  requireAdminOrAbove,
  requireSuperAdmin,
  canModifyUser,
  isSuperAdmin,
} from '@/lib/authUtils'
import prisma from '@/lib/prisma'
import { isEmail } from '@/lib/validation'
import { sanitizeLine } from '@/utils/sanitizeLine'

type Body = {
  name?: string
  lastName?: string
  biography?: string
  handler?: string
  userType?: string
  email?: string
  isFeatured?: boolean
  published?: boolean
}

type UserTypeValue = (typeof UserTypeEnum)[keyof typeof UserTypeEnum]

const toUserType = (val: unknown): UserTypeValue | undefined => {
  if (typeof val !== 'string') return undefined
  return (Object.values(UserTypeEnum) as string[]).includes(val)
    ? (val as UserTypeValue)
    : undefined
}

// Admin roles that require superAdmin to assign
const PROTECTED_ROLES: UserTypeValue[] = ['admin', 'superAdmin']

/* ------------------------ GET ------------------------ */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        handler: true,
        biography: true,
        userType: true,
        isFeatured: true,
        published: true,
        profileImageUrl: true,
        signatureUrl: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json(user)
  } catch (error) {
    console.error('[GET /api/users/[id]] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/* ------------------------ PUT ------------------------ */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Require admin or superAdmin
    const { session, error: authError } = await requireAdminOrAbove()
    if (authError) return authError

    const { id } = await context.params
    const body = (await request.json()) as Body

    // Get target user to check their role
    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if actor can modify target user based on role hierarchy
    if (!canModifyUser(session.user.userType, targetUser.userType)) {
      return NextResponse.json({ error: 'Forbidden - Cannot modify Super Admin' }, { status: 403 })
    }

    const userTypeEnum = toUserType(body.userType)
    if (body.userType && !userTypeEnum) {
      return NextResponse.json({ error: 'Invalid userType' }, { status: 400 })
    }

    // Only superAdmin can assign admin/superAdmin roles
    if (userTypeEnum && PROTECTED_ROLES.includes(userTypeEnum)) {
      if (!isSuperAdmin(session.user.userType)) {
        return NextResponse.json(
          { error: 'Forbidden - Only Super Admin can assign admin roles' },
          { status: 403 },
        )
      }
    }

    // Sanitize single-line text fields. Biography is rich-text HTML
    // (TipTap) — left untouched here, DOMPurify cleans it at render
    // time. Length caps on the sanitized values reject oversized
    // payloads that smuggled control chars to pad their byte count.
    const data: Prisma.UserUpdateInput = {}
    if (body.name !== undefined) {
      const v = sanitizeLine(String(body.name))
      if (v.length > 100) {
        return NextResponse.json({ error: 'Name too long.' }, { status: 400 })
      }
      data.name = v
    }
    if (body.lastName !== undefined) {
      const v = sanitizeLine(String(body.lastName))
      if (v.length > 100) {
        return NextResponse.json({ error: 'Last name too long.' }, { status: 400 })
      }
      data.lastName = v
    }
    if (body.biography !== undefined) data.biography = body.biography
    if (body.handler !== undefined) {
      const v = sanitizeLine(String(body.handler))
      if (v.length > 60) {
        return NextResponse.json({ error: 'Handler too long.' }, { status: 400 })
      }
      data.handler = v
    }
    if (body.email !== undefined) {
      const v = sanitizeLine(String(body.email))
      if (v.length > 200) {
        return NextResponse.json({ error: 'Email too long.' }, { status: 400 })
      }
      // Required + format-checked when supplied — mirrors the profile form's
      // client rule (shared `isEmail`) so the two never drift. Admin toggles
      // that don't send `email` are unaffected.
      if (!isEmail(v)) {
        return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
      }
      data.email = v
    }
    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured
    if (body.published !== undefined) data.published = body.published
    if (userTypeEnum !== undefined) data.userType = { set: userTypeEnum }

    const updated = await prisma.user.update({ where: { id }, data })

    // Cascade: unpublishing an artist also unpublishes all their exhibitions
    if (body.published === false) {
      await prisma.exhibition.updateMany({
        where: { userId: id, published: true },
        data: { published: false },
      })
    }

    // Revalidate artist caches
    revalidateTag('artists', 'default')
    if (updated.handler) {
      revalidateTag(`artist-${updated.handler}`, 'default')
    }
    revalidatePath('/')

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PUT /api/users/[id]] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/* ------------------------ DELETE ------------------------ */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Only superAdmin can delete users
    const { session, error: authError } = await requireSuperAdmin()
    if (authError) return authError

    const { id } = await context.params

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Forbidden - Cannot delete yourself' }, { status: 403 })
    }

    // Get target user to verify it exists
    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.user.delete({ where: { id } })

    // Revalidate artist caches
    revalidateTag('artists', 'default')
    if (targetUser.handler) {
      revalidateTag(`artist-${targetUser.handler}`, 'default')
    }
    revalidatePath('/')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/users/[id]] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
