import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const artists = await prisma.artist.findMany()
    return NextResponse.json(artists)
  } catch (error) {
    console.error('[GET /api/artists] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
