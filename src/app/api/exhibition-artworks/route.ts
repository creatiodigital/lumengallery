import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireOwnership, isSuperAdmin } from '@/lib/authUtils'
import { PUBLIC_ARTWORK_OMIT } from '@/lib/artworkFields'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET exhibition artworks (positions) for an exhibition
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const exhibitionId = searchParams.get('exhibitionId')

    if (!exhibitionId) {
      return NextResponse.json({ error: 'exhibitionId is required' }, { status: 400 })
    }

    // mode=edit → always live data (for the edit page)
    // no mode → serve snapshot if available (for visit/public)
    const mode = searchParams.get('mode')

    if (mode !== 'edit') {
      const exhibition = await prisma.exhibition.findUnique({
        where: { id: exhibitionId },
        select: { published: true, previewEnabled: true, publishedSnapshot: true },
      })

      // Serve snapshot for published or preview-enabled exhibitions
      const hasSnapshot = !!exhibition?.publishedSnapshot
      const shouldServeSnapshot =
        hasSnapshot && (exhibition?.published || exhibition?.previewEnabled)
      if (shouldServeSnapshot) {
        const snapshot = exhibition.publishedSnapshot as Record<string, unknown>
        const snapshotArtworks = (snapshot.artworks ?? []) as Array<Record<string, unknown>>

        // Fetch live artwork metadata so updates (title, dimensions, image, etc.)
        // are reflected immediately without re-publishing
        const artworkIds = snapshotArtworks
          .map((ea) => {
            const art = ea.artwork as Record<string, unknown> | undefined
            return (art?.id as string) ?? (ea.artworkId as string)
          })
          .filter(Boolean)

        const liveArtworks = await prisma.artwork.findMany({
          where: { id: { in: artworkIds } },
        })
        const liveById = Object.fromEntries(liveArtworks.map((a) => [a.id, a]))

        // Merge: snapshot layout + live artwork metadata
        const merged = snapshotArtworks.map((ea) => {
          const art = ea.artwork as Record<string, unknown> | undefined
          const artworkId = (art?.id as string) ?? (ea.artworkId as string)
          const live = liveById[artworkId]
          if (live) {
            return {
              ...ea,
              artwork: {
                ...art,
                // Override with live metadata
                slug: live.slug,
                name: live.name,
                artworkType: live.artworkType,
                title: live.title,
                author: live.author,
                year: live.year,
                technique: live.technique,
                dimensions: live.dimensions,
                description: live.description,
                imageUrl: live.imageUrl,
                textContent: live.textContent,
                soundUrl: live.soundUrl,
                videoUrl: live.videoUrl,
                originalWidth: live.originalWidth,
                originalHeight: live.originalHeight,
                featured: live.featured,
              },
            }
          }
          return ea
        })

        return NextResponse.json(merged)
      }
    }

    // Editor or no snapshot → return live data. Strip the full-res master
    // URL / metadata from the joined artwork — this endpoint is
    // unauthenticated and would otherwise leak every placed artwork's
    // 60MB+ print original (see /api/artworks GET).
    const exhibitionArtworks = await prisma.exhibitionArtwork.findMany({
      where: { exhibitionId },
      include: {
        artwork: {
          omit: PUBLIC_ARTWORK_OMIT,
        },
      },
    })

    return NextResponse.json(exhibitionArtworks)
  } catch (error) {
    console.error('[GET /api/exhibition-artworks] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST batch create/update exhibition artworks (requires auth + ownership)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { exhibitionId, positions } = body as {
      exhibitionId: string
      positions: Array<{
        artworkId: string
        wallId: string
        posX2d: number
        posY2d: number
        width2d: number
        height2d: number
        posX3d: number
        posY3d: number
        posZ3d: number
        quaternionX: number
        quaternionY: number
        quaternionZ: number
        quaternionW: number
        // Display properties (per-exhibition)
        showFrame?: boolean
        frameColor?: string
        frameSize?: number
        frameThickness?: number
        frameMaterial?: string
        frameCornerStyle?: string
        frameTextureScale?: number
        frameTextureRotation?: number
        frameTextureRoughness?: number
        frameTextureNormalScale?: number
        showPassepartout?: boolean
        passepartoutColor?: string
        passepartoutSize?: number
        passepartoutThickness?: number
        showPaperBorder?: boolean
        paperBorderSize?: number
        supportThickness?: number
        supportColor?: string
        showSupport?: boolean
        hideShadow?: boolean
        showArtworkInformation?: boolean
        // Text styling (per-exhibition)
        fontFamily?: string
        fontSize?: number
        fontWeight?: string
        letterSpacing?: number
        lineHeight?: number
        textColor?: string
        textBackgroundColor?: string
        textAlign?: string
        textVerticalAlign?: string
        textPadding?: number
        textPaddingTop?: number
        textPaddingBottom?: number
        textPaddingLeft?: number
        textPaddingRight?: number
        textThickness?: number
        textBackgroundTexture?: string | null
        showTextBorder?: boolean
        textBorderColor?: string
        textBorderOffset?: number
        showMonogram?: boolean
        monogramColor?: string
        monogramOpacity?: number
        monogramPosition?: string
        monogramOffset?: number
        monogramSize?: number
        // Sound styling (per-exhibition)
        soundIcon?: string
        soundBackgroundColor?: string | null
        soundIconColor?: string
        soundIconSize?: number
        soundPlayMode?: string
        soundSpatial?: boolean
        soundDistance?: number
        // Video playback (per-exhibition)
        videoPlayMode?: string
        videoLoop?: boolean
        videoVolume?: number
        videoProximityDistance?: number
        // Shape decoration
        shapeType?: string
        shapeColor?: string
        shapeOpacity?: number
        rotation?: number
        locked?: boolean
      }>
    }

    if (!exhibitionId || !positions || !Array.isArray(positions)) {
      return NextResponse.json(
        { error: 'exhibitionId and positions array are required' },
        { status: 400 },
      )
    }

    // Verify exhibition ownership
    const exhibition = await prisma.exhibition.findUnique({
      where: { id: exhibitionId },
      select: { userId: true },
    })
    if (!exhibition) return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
    const { session, error: authError } = await requireOwnership(exhibition.userId)
    if (authError) return authError

    // Ownership of the EXHIBITION is not enough — every incoming artwork must
    // also belong to the exhibition's owner. Without this an artist could
    // embed (and thereby surface/misattribute) another artist's work in their
    // own show by passing a foreign artworkId. superAdmin may place anything,
    // mirroring requireOwnership's bypass.
    const incomingArtworkIds = [...new Set(positions.map((p) => p.artworkId).filter(Boolean))]
    if (incomingArtworkIds.length > 0 && !isSuperAdmin(session?.user?.userType)) {
      const owned = await prisma.artwork.findMany({
        where: { id: { in: incomingArtworkIds } },
        select: { id: true, userId: true },
      })
      const allBelongToOwner =
        owned.length === incomingArtworkIds.length &&
        owned.every((a) => a.userId === exhibition.userId)
      if (!allBelongToOwner) {
        return NextResponse.json(
          { error: 'One or more artworks do not belong to this exhibition.' },
          { status: 403 },
        )
      }
    }

    // Get current artwork IDs in this exhibition
    const existingPositions = await prisma.exhibitionArtwork.findMany({
      where: { exhibitionId },
      select: { artworkId: true },
    })
    const existingArtworkIds = existingPositions.map((p) => p.artworkId)

    // Find artworks that were deleted (exist in DB but not in current positions)
    const currentArtworkIds = positions.map((p) => p.artworkId)
    const deletedArtworkIds = existingArtworkIds.filter((id) => !currentArtworkIds.includes(id))

    // Delete removed positions
    if (deletedArtworkIds.length > 0) {
      await prisma.exhibitionArtwork.deleteMany({
        where: {
          exhibitionId,
          artworkId: { in: deletedArtworkIds },
        },
      })
    }

    // Upsert remaining positions with display properties
    const results = await Promise.all(
      positions.map((pos) =>
        prisma.exhibitionArtwork.upsert({
          where: {
            exhibitionId_artworkId: {
              exhibitionId,
              artworkId: pos.artworkId,
            },
          },
          create: {
            exhibitionId,
            artworkId: pos.artworkId,
            wallId: pos.wallId,
            posX2d: pos.posX2d,
            posY2d: pos.posY2d,
            width2d: pos.width2d,
            height2d: pos.height2d,
            posX3d: pos.posX3d,
            posY3d: pos.posY3d,
            posZ3d: pos.posZ3d,
            quaternionX: pos.quaternionX,
            quaternionY: pos.quaternionY,
            quaternionZ: pos.quaternionZ,
            quaternionW: pos.quaternionW,
            // Display properties
            showFrame: pos.showFrame ?? false,
            frameColor: pos.frameColor ?? '#000000',
            frameSize: pos.frameSize ?? 5,
            frameThickness: pos.frameThickness ?? 2,
            frameMaterial: pos.frameMaterial ?? 'plastic',
            frameCornerStyle: pos.frameCornerStyle ?? 'mitered',
            frameTextureScale: pos.frameTextureScale ?? 2.0,
            frameTextureRotation: pos.frameTextureRotation ?? 0,
            frameTextureRoughness: pos.frameTextureRoughness ?? 0.6,
            frameTextureNormalScale: pos.frameTextureNormalScale ?? 0.5,
            showPassepartout: pos.showPassepartout ?? false,
            passepartoutColor: pos.passepartoutColor ?? '#ffffff',
            passepartoutSize: pos.passepartoutSize ?? 10,
            passepartoutThickness: pos.passepartoutThickness ?? 0.6,
            showPaperBorder: pos.showPaperBorder ?? false,
            paperBorderSize: pos.paperBorderSize ?? 0,
            supportThickness: pos.supportThickness ?? 2,
            supportColor: pos.supportColor ?? '#ffffff',
            showSupport: pos.showSupport ?? false,
            hideShadow: pos.hideShadow ?? false,
            showArtworkInformation: pos.showArtworkInformation ?? false,
            // Text display properties
            fontFamily: pos.fontFamily ?? 'Montserrat',
            fontSize: pos.fontSize ?? 16,
            fontWeight: pos.fontWeight ?? 'regular',
            letterSpacing: pos.letterSpacing ?? 0,
            lineHeight: pos.lineHeight ?? 1.4,
            textColor: pos.textColor ?? '#000000',
            textBackgroundColor: pos.textBackgroundColor ?? null,
            textAlign: pos.textAlign ?? 'left',
            textVerticalAlign: pos.textVerticalAlign ?? 'top',
            textPadding: pos.textPadding ?? 0,
            textPaddingTop: pos.textPaddingTop ?? 0,
            textPaddingBottom: pos.textPaddingBottom ?? 0,
            textPaddingLeft: pos.textPaddingLeft ?? 0,
            textPaddingRight: pos.textPaddingRight ?? 0,
            textThickness: pos.textThickness ?? 0,
            textBackgroundTexture: pos.textBackgroundTexture ?? null,
            showTextBorder: pos.showTextBorder ?? false,
            textBorderColor: pos.textBorderColor ?? '#c9a96e',
            textBorderOffset: pos.textBorderOffset ?? 1.2,
            showMonogram: pos.showMonogram ?? false,
            monogramColor: pos.monogramColor ?? '#c0392b',
            monogramOpacity: pos.monogramOpacity ?? 1.0,
            monogramPosition: pos.monogramPosition ?? 'bottom',
            monogramOffset: pos.monogramOffset ?? 6,
            monogramSize: pos.monogramSize ?? 18,
            // Sound styling
            soundIcon: pos.soundIcon ?? 'volume-2',
            soundBackgroundColor: pos.soundBackgroundColor ?? null,
            soundIconColor: pos.soundIconColor ?? '#000000',
            soundIconSize: pos.soundIconSize ?? 24,
            soundPlayMode: pos.soundPlayMode ?? 'play-once',
            soundSpatial: pos.soundSpatial ?? true,
            soundDistance: pos.soundDistance ?? 5,
            // Video playback
            videoPlayMode: pos.videoPlayMode ?? 'proximity',
            videoLoop: pos.videoLoop ?? true,
            videoVolume: pos.videoVolume ?? 1.0,
            videoProximityDistance: pos.videoProximityDistance ?? 3,
            // Shape decoration
            shapeType: pos.shapeType ?? 'rectangle',
            shapeColor: pos.shapeColor ?? '#000000',
            shapeOpacity: pos.shapeOpacity ?? 1,
            rotation: pos.rotation ?? 0,
            locked: pos.locked ?? false,
          },
          update: {
            wallId: pos.wallId,
            posX2d: pos.posX2d,
            posY2d: pos.posY2d,
            width2d: pos.width2d,
            height2d: pos.height2d,
            posX3d: pos.posX3d,
            posY3d: pos.posY3d,
            posZ3d: pos.posZ3d,
            quaternionX: pos.quaternionX,
            quaternionY: pos.quaternionY,
            quaternionZ: pos.quaternionZ,
            quaternionW: pos.quaternionW,
            // Display properties
            showFrame: pos.showFrame ?? false,
            frameColor: pos.frameColor ?? '#000000',
            frameSize: pos.frameSize ?? 5,
            frameThickness: pos.frameThickness ?? 2,
            frameMaterial: pos.frameMaterial ?? 'plastic',
            frameCornerStyle: pos.frameCornerStyle ?? 'mitered',
            frameTextureScale: pos.frameTextureScale ?? 2.0,
            frameTextureRotation: pos.frameTextureRotation ?? 0,
            frameTextureRoughness: pos.frameTextureRoughness ?? 0.6,
            frameTextureNormalScale: pos.frameTextureNormalScale ?? 0.5,
            showPassepartout: pos.showPassepartout ?? false,
            passepartoutColor: pos.passepartoutColor ?? '#ffffff',
            passepartoutSize: pos.passepartoutSize ?? 10,
            passepartoutThickness: pos.passepartoutThickness ?? 0.6,
            showPaperBorder: pos.showPaperBorder ?? false,
            paperBorderSize: pos.paperBorderSize ?? 0,
            supportThickness: pos.supportThickness ?? 2,
            supportColor: pos.supportColor ?? '#ffffff',
            showSupport: pos.showSupport ?? false,
            hideShadow: pos.hideShadow ?? false,
            showArtworkInformation: pos.showArtworkInformation ?? false,
            // Text display properties
            fontFamily: pos.fontFamily ?? 'Montserrat',
            fontSize: pos.fontSize ?? 16,
            fontWeight: pos.fontWeight ?? 'regular',
            letterSpacing: pos.letterSpacing ?? 0,
            lineHeight: pos.lineHeight ?? 1.4,
            textColor: pos.textColor ?? '#000000',
            textBackgroundColor: pos.textBackgroundColor ?? null,
            textAlign: pos.textAlign ?? 'left',
            textVerticalAlign: pos.textVerticalAlign ?? 'top',
            textPadding: pos.textPadding ?? 0,
            textPaddingTop: pos.textPaddingTop ?? 0,
            textPaddingBottom: pos.textPaddingBottom ?? 0,
            textPaddingLeft: pos.textPaddingLeft ?? 0,
            textPaddingRight: pos.textPaddingRight ?? 0,
            textThickness: pos.textThickness ?? 0,
            textBackgroundTexture: pos.textBackgroundTexture ?? null,
            showTextBorder: pos.showTextBorder ?? false,
            textBorderColor: pos.textBorderColor ?? '#c9a96e',
            textBorderOffset: pos.textBorderOffset ?? 1.2,
            showMonogram: pos.showMonogram ?? false,
            monogramColor: pos.monogramColor ?? '#c0392b',
            monogramOpacity: pos.monogramOpacity ?? 1.0,
            monogramPosition: pos.monogramPosition ?? 'bottom',
            monogramOffset: pos.monogramOffset ?? 6,
            monogramSize: pos.monogramSize ?? 18,
            // Sound styling
            soundIcon: pos.soundIcon ?? 'volume-2',
            soundBackgroundColor: pos.soundBackgroundColor ?? null,
            soundIconColor: pos.soundIconColor ?? '#000000',
            soundIconSize: pos.soundIconSize ?? 24,
            soundPlayMode: pos.soundPlayMode ?? 'play-once',
            soundSpatial: pos.soundSpatial ?? true,
            soundDistance: pos.soundDistance ?? 5,
            // Video playback
            videoPlayMode: pos.videoPlayMode ?? 'proximity',
            videoLoop: pos.videoLoop ?? true,
            videoVolume: pos.videoVolume ?? 1.0,
            videoProximityDistance: pos.videoProximityDistance ?? 3,
            // Shape decoration
            shapeType: pos.shapeType ?? 'rectangle',
            shapeColor: pos.shapeColor ?? '#000000',
            shapeOpacity: pos.shapeOpacity ?? 1,
            rotation: pos.rotation ?? 0,
            locked: pos.locked ?? false,
          },
        }),
      ),
    )

    // If the exhibition is published or has preview enabled, mark it as having pending changes
    const exhibitionStatus = await prisma.exhibition.findUnique({
      where: { id: exhibitionId },
      select: { published: true, previewEnabled: true },
    })
    if (exhibitionStatus?.published || exhibitionStatus?.previewEnabled) {
      await prisma.exhibition.update({
        where: { id: exhibitionId },
        data: { hasPendingChanges: true },
      })
    }

    return NextResponse.json(
      {
        count: results.length,
        deleted: deletedArtworkIds.length,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/exhibition-artworks] error:', error)
    return NextResponse.json({ error: 'Failed to save positions' }, { status: 500 })
  }
}
