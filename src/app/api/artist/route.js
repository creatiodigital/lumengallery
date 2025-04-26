import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const handler = searchParams.get('handler')

    console.log('[GET /api/artist] handler:', handler)

    if (!handler) {
      return NextResponse.json({ error: 'Missing handler' }, { status: 400 })
    }

    const artist = await prisma.artist.findUnique({
      where: { handler },
    })

    console.log('[GET /api/artist] artist:', artist)

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    return NextResponse.json(artist)
  } catch (error) {
    console.error('[GET /api/artist] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
