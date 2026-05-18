import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { MAX_UPLOAD_SIZE } from '@/lib/imageConfig'
import { processImage, isValidImageType } from '@/lib/imageProcessor'
import prisma from '@/lib/prisma'
import { uploadToR2, deleteFromR2, buildSlideImageKey } from '@/lib/r2'

const MAX_FILE_SIZE = MAX_UPLOAD_SIZE

// POST - Upload image for a slide
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const slide = await prisma.slide.findUnique({ where: { id } })
    if (!slide) {
      return NextResponse.json({ error: 'Slide not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (!isValidImageType(buffer)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.' },
        { status: 400 },
      )
    }

    const processedBuffer = await processImage(buffer)

    // Delete old image if it's hosted on R2 or Vercel Blob
    if (slide.imageUrl) {
      try {
        await deleteFromR2(slide.imageUrl)
      } catch (error) {
        console.warn('Failed to delete old slide image:', error)
      }
    }

    // Upload to Cloudflare R2
    const key = await buildSlideImageKey(id)
    const url = await uploadToR2(key, processedBuffer, 'image/webp')

    // Update slide with new image URL
    await prisma.slide.update({
      where: { id },
      data: { imageUrl: url },
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error('[POST /api/slides/[id]/image] error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}

// DELETE - Remove the slide's image (clears imageUrl + removes R2 object).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const slide = await prisma.slide.findUnique({ where: { id } })
    if (!slide) {
      return NextResponse.json({ error: 'Slide not found' }, { status: 404 })
    }

    if (slide.imageUrl) {
      try {
        await deleteFromR2(slide.imageUrl)
      } catch (error) {
        console.warn('Failed to delete slide image from R2:', error)
      }
    }

    await prisma.slide.update({ where: { id }, data: { imageUrl: '' } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/slides/[id]/image] error:', error)
    return NextResponse.json({ error: 'Failed to remove image' }, { status: 500 })
  }
}
