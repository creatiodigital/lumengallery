import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request) {
  try {
    const body = await request.json()
    const { id, name, lastName, biography, handler, email } = body

    console.log('[POST] Updating artist:', body)

    if (!id) {
      return NextResponse.json({ error: 'Missing artist ID' }, { status: 400 })
    }

    const updated = await prisma.artist.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(lastName && { lastName }),
        ...(biography && { biography }),
        ...(handler && { handler }),
        ...(email && { email }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[POST /api/artist/update] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
