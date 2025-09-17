import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import type { Exhibition } from '@/generated/prisma'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      mainTitle: string
      visibility: string
      userId: string
      handler: string
      url: string
      spaceId: string
    }

    const { mainTitle, visibility, userId, handler, url, spaceId } = body

    const exhibition: Exhibition = await prisma.exhibition.create({
      data: {
        mainTitle,
        visibility,
        userId,
        handler,
        url,
        spaceId,
        status: 'DRAFT',
      },
    })

    return NextResponse.json(exhibition, { status: 201 })
  } catch (error) {
    console.error('[POST /api/exhibitions] error:', error)
    return NextResponse.json({ error: 'Failed to create exhibition' }, { status: 500 })
  }
}
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  try {
    const exhibitions: Exhibition[] = await prisma.exhibition.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(exhibitions)
  } catch (error) {
    console.error('[GET /api/exhibitions] error:', error)
    return NextResponse.json({ error: 'Failed to fetch exhibitions' }, { status: 500 })
  }
}
