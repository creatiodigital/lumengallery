import { revalidateTag, revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

// POST reorder slides (admin only)
export async function POST(request: Request) {
  try {
    // Require admin role
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const { slideIds } = body as { slideIds: string[] }

    if (!Array.isArray(slideIds)) {
      return NextResponse.json({ error: 'slideIds must be an array' }, { status: 400 })
    }

    // Update each slide's order based on its position in the array
    await prisma.$transaction(
      slideIds.map((id, index) =>
        prisma.slide.update({
          where: { id },
          data: { order: index },
        }),
      ),
    )

    // Bust the homepage cache so the new order appears immediately.
    // Without this, /app/page.tsx's unstable_cache (revalidate: 3600)
    // keeps serving the old order for up to an hour after a reorder.
    revalidateTag('homepage', 'default')
    revalidatePath('/')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering slides:', error)
    return NextResponse.json({ error: 'Failed to reorder slides' }, { status: 500 })
  }
}
