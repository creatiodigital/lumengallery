import { NextResponse } from 'next/server'

import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET all presets for authenticated user
export async function GET() {
  try {
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const presets = await prisma.artworkPreset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(presets)
  } catch (error) {
    console.error('[GET /api/presets] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST create a new preset
export async function POST(request: Request) {
  try {
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const body = await request.json()

    const preset = await prisma.artworkPreset.create({
      data: {
        userId,
        name: body.name,
        presetType: body.presetType || 'image',
        // Dimensions
        width2d: Number(body.width2d) || 100,
        height2d: Number(body.height2d) || 100,
        // Frame
        showFrame: body.showFrame ?? false,
        frameColor: body.frameColor ?? '#000000',
        frameSize: body.frameSize != null ? Number(body.frameSize) : 5,
        frameThickness: body.frameThickness != null ? Number(body.frameThickness) : 0.5,
        frameMaterial: body.frameMaterial ?? 'plastic',
        frameCornerStyle: body.frameCornerStyle ?? 'mitered',
        frameTextureScale: body.frameTextureScale != null ? Number(body.frameTextureScale) : 2.0,
        frameTextureRotation:
          body.frameTextureRotation != null ? Number(body.frameTextureRotation) : 0,
        frameTextureRoughness:
          body.frameTextureRoughness != null ? Number(body.frameTextureRoughness) : 0.6,
        frameTextureNormalScale:
          body.frameTextureNormalScale != null ? Number(body.frameTextureNormalScale) : 0.5,
        // Passepartout
        showPassepartout: body.showPassepartout ?? false,
        passepartoutColor: body.passepartoutColor ?? '#ffffff',
        passepartoutSize: body.passepartoutSize != null ? Number(body.passepartoutSize) : 10,
        passepartoutThickness:
          body.passepartoutThickness != null ? Number(body.passepartoutThickness) : 0.3,
        // Border (white paper margin around image)
        showPaperBorder: body.showPaperBorder ?? false,
        paperBorderSize: body.paperBorderSize != null ? Number(body.paperBorderSize) : 0,
        // Support
        showSupport: body.showSupport ?? false,
        supportThickness: body.supportThickness != null ? Number(body.supportThickness) : 2.0,
        supportColor: body.supportColor ?? '#ffffff',
        // Shadow
        hideShadow: body.hideShadow ?? false,
        // Text styling
        fontFamily: body.fontFamily ?? 'Montserrat',
        fontSize: Number(body.fontSize) || 16,
        fontWeight: body.fontWeight ?? 'regular',
        letterSpacing: body.letterSpacing != null ? Number(body.letterSpacing) : 0,
        lineHeight: Number(body.lineHeight) || 1.4,
        textColor: body.textColor ?? '#000000',
        textBackgroundColor: body.textBackgroundColor ?? null,
        textAlign: body.textAlign ?? 'left',
        textVerticalAlign: body.textVerticalAlign ?? 'top',
        textPadding: body.textPadding != null ? Number(body.textPadding) : 0,
        textPaddingTop: body.textPaddingTop != null ? Number(body.textPaddingTop) : 0,
        textPaddingBottom: body.textPaddingBottom != null ? Number(body.textPaddingBottom) : 0,
        textPaddingLeft: body.textPaddingLeft != null ? Number(body.textPaddingLeft) : 0,
        textPaddingRight: body.textPaddingRight != null ? Number(body.textPaddingRight) : 0,
        textThickness: body.textThickness != null ? Number(body.textThickness) : 0,
        textBackgroundTexture: body.textBackgroundTexture ?? null,
        showTextBorder: body.showTextBorder ?? false,
        textBorderColor: body.textBorderColor ?? '#c9a96e',
        textBorderOffset: body.textBorderOffset != null ? Number(body.textBorderOffset) : 1.2,
        showMonogram: body.showMonogram ?? false,
        monogramColor: body.monogramColor ?? '#c0392b',
        monogramOpacity: body.monogramOpacity != null ? Number(body.monogramOpacity) : 1.0,
        monogramPosition: body.monogramPosition ?? 'bottom',
        monogramOffset: body.monogramOffset != null ? Number(body.monogramOffset) : 6,
        monogramSize: body.monogramSize != null ? Number(body.monogramSize) : 18,
        // Shape properties
        shapeType: body.shapeType ?? 'rectangle',
        shapeColor: body.shapeColor ?? '#000000',
        shapeOpacity: body.shapeOpacity != null ? Number(body.shapeOpacity) : 1,
      },
    })

    return NextResponse.json(preset, { status: 201 })
  } catch (error) {
    console.error('[POST /api/presets] error:', error)
    return NextResponse.json({ error: 'Failed to create preset' }, { status: 500 })
  }
}
