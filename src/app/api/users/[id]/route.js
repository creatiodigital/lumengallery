import { NextResponse } from 'next/server'

import prisma from '@/lib/prisma'

export async function GET(_, { params }) {
  const { id } = params

  try {
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('[GET /api/users/[id]] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    const { name, lastName, biography, handler, userType, email } = body

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(lastName && { lastName }),
        ...(biography && { biography }),
        ...(userType && { userType }),
        ...(handler && { handler }),
        ...(email && { email }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PUT /api/users/[id]] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
