import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

// DELETE a preset
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const { id } = await context.params

    // Verify ownership
    const preset = await prisma.artworkPreset.findUnique({
      where: { id },
    })

    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    if (preset.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await prisma.artworkPreset.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/presets/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 })
  }
}

// PUT update an existing preset
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const { id } = await context.params
    const body = await request.json()

    // Verify ownership
    const preset = await prisma.artworkPreset.findUnique({
      where: { id },
    })

    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    if (preset.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const updated = await prisma.artworkPreset.update({
      where: { id },
      data: {
        // Dimensions
        width2d: Number(body.width2d) || preset.width2d,
        height2d: Number(body.height2d) || preset.height2d,
        // Frame
        showFrame: body.showFrame ?? preset.showFrame,
        frameColor: body.frameColor ?? preset.frameColor,
        frameSize: body.frameSize != null ? Number(body.frameSize) : preset.frameSize,
        frameThickness:
          body.frameThickness != null ? Number(body.frameThickness) : preset.frameThickness,
        frameMaterial: body.frameMaterial ?? preset.frameMaterial,
        frameCornerStyle: body.frameCornerStyle ?? preset.frameCornerStyle,
        frameTextureScale:
          body.frameTextureScale != null
            ? Number(body.frameTextureScale)
            : preset.frameTextureScale,
        frameTextureRotation:
          body.frameTextureRotation != null
            ? Number(body.frameTextureRotation)
            : preset.frameTextureRotation,
        frameTextureRoughness:
          body.frameTextureRoughness != null
            ? Number(body.frameTextureRoughness)
            : preset.frameTextureRoughness,
        frameTextureNormalScale:
          body.frameTextureNormalScale != null
            ? Number(body.frameTextureNormalScale)
            : preset.frameTextureNormalScale,
        // Passepartout
        showPassepartout: body.showPassepartout ?? preset.showPassepartout,
        passepartoutColor: body.passepartoutColor ?? preset.passepartoutColor,
        passepartoutSize:
          body.passepartoutSize != null ? Number(body.passepartoutSize) : preset.passepartoutSize,
        passepartoutThickness:
          body.passepartoutThickness != null
            ? Number(body.passepartoutThickness)
            : preset.passepartoutThickness,
        // Border (white paper margin around image)
        showPaperBorder: body.showPaperBorder ?? preset.showPaperBorder,
        paperBorderSize:
          body.paperBorderSize != null ? Number(body.paperBorderSize) : preset.paperBorderSize,
        // Support
        showSupport: body.showSupport ?? preset.showSupport,
        supportThickness:
          body.supportThickness != null ? Number(body.supportThickness) : preset.supportThickness,
        supportColor: body.supportColor ?? preset.supportColor,
        // Shadow
        hideShadow: body.hideShadow ?? preset.hideShadow,
        // Text styling
        fontFamily: body.fontFamily ?? preset.fontFamily,
        fontSize: body.fontSize != null ? Number(body.fontSize) : preset.fontSize,
        fontWeight: body.fontWeight ?? preset.fontWeight,
        letterSpacing:
          body.letterSpacing != null ? Number(body.letterSpacing) : preset.letterSpacing,
        lineHeight: body.lineHeight != null ? Number(body.lineHeight) : preset.lineHeight,
        textColor: body.textColor ?? preset.textColor,
        textBackgroundColor:
          body.textBackgroundColor !== undefined
            ? body.textBackgroundColor
            : preset.textBackgroundColor,
        textAlign: body.textAlign ?? preset.textAlign,
        textVerticalAlign: body.textVerticalAlign ?? preset.textVerticalAlign,
        textPadding: body.textPadding != null ? Number(body.textPadding) : preset.textPadding,
        textPaddingTop:
          body.textPaddingTop != null ? Number(body.textPaddingTop) : preset.textPaddingTop,
        textPaddingBottom:
          body.textPaddingBottom != null
            ? Number(body.textPaddingBottom)
            : preset.textPaddingBottom,
        textPaddingLeft:
          body.textPaddingLeft != null ? Number(body.textPaddingLeft) : preset.textPaddingLeft,
        textPaddingRight:
          body.textPaddingRight != null ? Number(body.textPaddingRight) : preset.textPaddingRight,
        textThickness:
          body.textThickness != null ? Number(body.textThickness) : preset.textThickness,
        textBackgroundTexture:
          body.textBackgroundTexture !== undefined
            ? body.textBackgroundTexture
            : preset.textBackgroundTexture,
        showTextBorder:
          body.showTextBorder !== undefined ? body.showTextBorder : preset.showTextBorder,
        textBorderColor: body.textBorderColor ?? preset.textBorderColor,
        textBorderOffset:
          body.textBorderOffset != null ? Number(body.textBorderOffset) : preset.textBorderOffset,
        showMonogram: body.showMonogram !== undefined ? body.showMonogram : preset.showMonogram,
        monogramColor: body.monogramColor ?? preset.monogramColor,
        monogramOpacity:
          body.monogramOpacity != null ? Number(body.monogramOpacity) : preset.monogramOpacity,
        monogramPosition: body.monogramPosition ?? preset.monogramPosition,
        monogramOffset:
          body.monogramOffset != null ? Number(body.monogramOffset) : preset.monogramOffset,
        monogramSize: body.monogramSize != null ? Number(body.monogramSize) : preset.monogramSize,
        // Shape properties
        shapeType: body.shapeType ?? preset.shapeType,
        shapeColor: body.shapeColor ?? preset.shapeColor,
        shapeOpacity: body.shapeOpacity != null ? Number(body.shapeOpacity) : preset.shapeOpacity,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PUT /api/presets/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to update preset' }, { status: 500 })
  }
}
