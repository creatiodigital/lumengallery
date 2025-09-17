import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'

type RouteParams = { params: { id: string } }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params
    await prisma.exhibition.delete({ where: { id } })
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('[DELETE /api/exhibitions/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete exhibition' }, { status: 500 })
  }
}
