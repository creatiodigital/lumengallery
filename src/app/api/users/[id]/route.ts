import { NextResponse, type NextRequest } from 'next/server'

import type { Prisma } from '@/generated/prisma'
import { UserType as UserTypeEnum } from '@/generated/prisma'
import prisma from '@/lib/prisma'

type RouteParams = { params: { id: string } }

type Body = {
  name?: string
  lastName?: string
  biography?: string
  handler?: string
  userType?: string
  email?: string
}

type UserTypeValue = (typeof UserTypeEnum)[keyof typeof UserTypeEnum]

const toUserType = (val: unknown): UserTypeValue | undefined => {
  if (typeof val !== 'string') return undefined
  return (Object.values(UserTypeEnum) as string[]).includes(val)
    ? (val as UserTypeValue)
    : undefined
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = params
  try {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json(user)
  } catch (error) {
    console.error('[GET /api/users/[id]] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params
    const body = (await request.json()) as Body

    const userTypeEnum = toUserType(body.userType)
    if (body.userType && !userTypeEnum) {
      return NextResponse.json({ error: 'Invalid userType' }, { status: 400 })
    }

    const data: Prisma.UserUpdateInput = {}
    if (body.name !== undefined) data.name = body.name
    if (body.lastName !== undefined) data.lastName = body.lastName
    if (body.biography !== undefined) data.biography = body.biography
    if (body.handler !== undefined) data.handler = body.handler
    if (body.email !== undefined) data.email = body.email
    if (userTypeEnum !== undefined) data.userType = { set: userTypeEnum }

    const updated = await prisma.user.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PUT /api/users/[id]] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
