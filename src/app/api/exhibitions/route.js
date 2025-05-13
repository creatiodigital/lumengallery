import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request) {
  try {
    const body = await request.json()
    const { mainTitle, visibility, userId, handler, url, spaceId } = body

    console.log('[POST /api/exhibitions] payload:', body)

    const exhibition = await prisma.exhibition.create({
      data: {
        mainTitle: 'Photography 1',
        visibility,
        userId,
        handler,
        url,
        spaceId,
        status: 'DRAFT', // hardcoded for now
      },
    })

    return NextResponse.json(exhibition, { status: 201 })
  } catch (error) {
    console.error('[POST /api/exhibitions] error:', error)
    return NextResponse.json({ error: 'Failed to create exhibition' }, { status: 500 })
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  try {
    const exhibitions = await prisma.exhibition.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(exhibitions)
  } catch (error) {
    console.error('[GET /api/exhibitions] error:', error)
    return NextResponse.json({ error: 'Failed to fetch exhibitions' }, { status: 500 })
  }
}
