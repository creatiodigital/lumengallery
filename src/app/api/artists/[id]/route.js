import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(request, context) {
  try {
    const { id } = context.params
    const body = await request.json()
    const { name, lastName, biography, handler, userType, email } = body

    console.log('[PUT] Updating artist:', { id, ...body })

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
