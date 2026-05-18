import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

// GET single slide
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const slide = await prisma.slide.findUnique({
      where: { id },
    })

    if (!slide) {
      return NextResponse.json({ error: 'Slide not found' }, { status: 404 })
    }

    return NextResponse.json(slide)
  } catch (error) {
    console.error('Error fetching slide:', error)
    return NextResponse.json({ error: 'Failed to fetch slide' }, { status: 500 })
  }
}

// PUT update slide (admin only)
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    // Require admin role
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { id } = await params
    const body = await request.json()
    const { imageUrl, title, subtitle, meta, exhibitionUrl, order, isActive, textColor } = body

    const slide = await prisma.slide.update({
      where: { id },
      data: {
        imageUrl,
        title,
        subtitle,
        meta,
        exhibitionUrl,
        order,
        isActive,
        ...(textColor ? { textColor } : {}),
      },
    })

    // Revalidate homepage
    revalidatePath('/')

    return NextResponse.json(slide)
  } catch (error) {
    console.error('Error updating slide:', error)
    return NextResponse.json({ error: 'Failed to update slide' }, { status: 500 })
  }
}

// DELETE slide (admin only)
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    // Require admin role
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { id } = await params
    await prisma.slide.delete({
      where: { id },
    })

    // Revalidate homepage
    revalidatePath('/')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting slide:', error)
    return NextResponse.json({ error: 'Failed to delete slide' }, { status: 500 })
  }
}
