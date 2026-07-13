import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'

// Public exhibition read (snapshot path). No data cache: read fresh so edits
// and reordering reflect immediately. The 3D scene still comes from the
// exhibition's publishedSnapshot below; only live metadata is enriched.
const getExhibition = (url: string) =>
  prisma.exhibition.findUnique({
    where: { url },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          lastName: true,
          handler: true,
          biography: true,
        },
      },
      exhibitionArtworks: {
        include: {
          artwork: {
            // Full public artwork shape (see ExhibitionArtworkResponse): on the
            // legacy no-snapshot path these rows feed the 3D scene directly, so
            // media/text fields must be present. Never add originalImageUrl —
            // this endpoint is public (60MB+ print master, see PUBLIC_ARTWORK_OMIT).
            select: {
              id: true,
              slug: true,
              name: true,
              title: true,
              author: true,
              year: true,
              technique: true,
              dimensions: true,
              description: true,
              imageUrl: true,
              artworkType: true,
              textContent: true,
              soundUrl: true,
              videoUrl: true,
              originalWidth: true,
              originalHeight: true,
              featured: true,
              hiddenFromExhibition: true,
            },
          },
        },
      },
    },
  })

export async function GET(_req: NextRequest, context: { params: Promise<{ url: string }> }) {
  try {
    const { url } = await context.params
    const mode = _req.nextUrl.searchParams.get('mode')

    // Edit mode → always fresh data, bypass cache
    if (mode === 'edit') {
      return getEditModeResponse(url)
    }

    // Public view → fresh read
    const exhibition = await getExhibition(url)

    if (!exhibition) {
      return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
    }

    // If exhibition is not published, check permissions or preview mode
    if (!exhibition.published) {
      const previewParam = _req.nextUrl.searchParams.get('preview')
      let isValidPreview = false

      if (previewParam) {
        // Fresh DB read for access control — never trust the cache for this
        const fresh = await prisma.exhibition.findUnique({
          where: { url },
          select: { previewEnabled: true, previewToken: true },
        })
        isValidPreview =
          !!fresh?.previewEnabled && !!fresh?.previewToken && previewParam === fresh.previewToken
      }

      if (!isValidPreview) {
        const session = await auth()
        const isOwner = session?.user?.id === exhibition.userId
        const userType = session?.user?.userType
        const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
        if (!isOwner && !isAdminOrAbove) {
          return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
        }
      }
    }

    // --- Draft/Publish logic ---
    const snapshot = exhibition.publishedSnapshot as Record<string, unknown> | null

    // Serve snapshot for published exhibitions OR valid preview requests
    const isValidPreviewRequest = !exhibition.published && _req.nextUrl.searchParams.get('preview')
    if ((exhibition.published || isValidPreviewRequest) && snapshot) {
      // Frozen snapshot data → return snapshot (same for published and preview)
      const snapshotExhibition = snapshot.exhibition as Record<string, unknown>
      const snapshotArtworks = snapshot.artworks as Array<Record<string, unknown>>

      // Reconstruct the response shape from the snapshot
      // Enrich snapshot artworks with live metadata so edits reflect immediately
      const snapshotArtworkObjects = (snapshotArtworks || [])
        .map((ea) => ea.artwork as Record<string, unknown>)
        .filter((artwork) => !artwork.hiddenFromExhibition && artwork.artworkType === 'image')

      // Fetch live rows for EVERY snapshot entry (all artwork types), not just
      // the image subset above: the enriched `exhibitionArtworks` below feeds
      // the 3D scene directly (the visit page no longer makes a second
      // /api/exhibition-artworks request), so sound/video/text artworks need
      // their live metadata here too.
      const allSnapshotArtworkIds = (snapshotArtworks || [])
        .map((ea) => {
          const art = ea.artwork as Record<string, unknown> | undefined
          return (art?.id as string) ?? (ea.artworkId as string)
        })
        .filter(Boolean)

      const liveArtworks = await prisma.artwork.findMany({
        where: { id: { in: allSnapshotArtworkIds } },
        select: {
          id: true,
          slug: true,
          name: true,
          artworkType: true,
          title: true,
          author: true,
          year: true,
          technique: true,
          dimensions: true,
          description: true,
          imageUrl: true,
          textContent: true,
          soundUrl: true,
          videoUrl: true,
          originalWidth: true,
          originalHeight: true,
          featured: true,
          hiddenFromExhibition: true,
        },
      })
      const liveById = Object.fromEntries(liveArtworks.map((a) => [a.id, a]))

      // Snapshot layout + live artwork metadata — the exact merge
      // /api/exhibition-artworks performs, relocated here so a public visit
      // is a single round trip. Positions/display props stay frozen in the
      // snapshot; only artwork metadata (title, image, media URLs…) is live.
      const enrichedExhibitionArtworks = (snapshotArtworks || []).map((ea) => {
        const art = ea.artwork as Record<string, unknown> | undefined
        const artworkId = (art?.id as string) ?? (ea.artworkId as string)
        const live = liveById[artworkId]
        if (!live) return ea
        return {
          ...ea,
          artwork: {
            ...art,
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
      })

      const artworks = snapshotArtworkObjects
        .map((artwork) => {
          const live = liveById[artwork.id as string]
          if (!live) return artwork
          return {
            ...artwork,
            slug: live.slug,
            name: live.name,
            title: live.title,
            author: live.author,
            year: live.year,
            technique: live.technique,
            dimensions: live.dimensions,
            description: live.description,
            imageUrl: live.imageUrl,
          }
        })
        .filter((artwork) => {
          const live = liveById[artwork.id as string]
          return !live?.hiddenFromExhibition
        })

      return NextResponse.json({
        ...exhibition,
        // Exhibition content comes from live DB (via ...exhibition spread above)
        // Only 3D scene settings come from the snapshot
        spaceId: snapshotExhibition.spaceId,
        // Lighting
        ambientLightColor: snapshotExhibition.ambientLightColor,
        ambientLightIntensity: snapshotExhibition.ambientLightIntensity,
        skylightColor: snapshotExhibition.skylightColor,
        skylightIntensity: snapshotExhibition.skylightIntensity,
        ceilingLampColor: snapshotExhibition.ceilingLampColor,
        ceilingLampIntensity: snapshotExhibition.ceilingLampIntensity,
        trackLampColor: snapshotExhibition.trackLampColor,
        trackLampIntensity: snapshotExhibition.trackLampIntensity,
        trackLampsVisible: snapshotExhibition.trackLampsVisible,
        recessedLampColor: snapshotExhibition.recessedLampColor,
        recessedLampIntensity: snapshotExhibition.recessedLampIntensity,
        trackLampMaterialColor: snapshotExhibition.trackLampMaterialColor,
        trackLampAngle: snapshotExhibition.trackLampAngle,
        trackLampDistance: snapshotExhibition.trackLampDistance,
        trackLampSettings: snapshotExhibition.trackLampSettings,
        windowLightColor: snapshotExhibition.windowLightColor,
        windowLightIntensity: snapshotExhibition.windowLightIntensity,
        windowTransparency: snapshotExhibition.windowTransparency,
        hdriRotation: snapshotExhibition.hdriRotation,
        // Floor
        floorReflectiveness: snapshotExhibition.floorReflectiveness,
        floorMaterial: snapshotExhibition.floorMaterial,
        floorTextureScale: snapshotExhibition.floorTextureScale,
        floorTextureOffsetX: snapshotExhibition.floorTextureOffsetX,
        floorTextureOffsetY: snapshotExhibition.floorTextureOffsetY,
        floorTemperature: snapshotExhibition.floorTemperature,
        floorNormalScale: snapshotExhibition.floorNormalScale,
        floorRotation: snapshotExhibition.floorRotation,
        // Environment & Camera
        hdriEnvironment: snapshotExhibition.hdriEnvironment,
        ceilingLightMode: snapshotExhibition.ceilingLightMode,
        cameraFOV: snapshotExhibition.cameraFOV,
        cameraElevation: snapshotExhibition.cameraElevation,

        // Wall & Ceiling
        wallColor: snapshotExhibition.wallColor,
        ceilingColor: snapshotExhibition.ceilingColor,
        wallBrightness: snapshotExhibition.wallBrightness,
        // Autofocus groups
        autofocusGroups: snapshotExhibition.autofocusGroups,
        // Snapshot positions enriched with live artwork metadata — consumed
        // directly by the 3D scene (no second request).
        exhibitionArtworks: enrichedExhibitionArtworks,
        artworks,
      })
    }

    // Legacy published exhibition (no snapshot) → return live data
    const artworks = exhibition.exhibitionArtworks
      .map((ea) => ea.artwork)
      .filter((artwork) => !artwork.hiddenFromExhibition && artwork.artworkType === 'image')

    return NextResponse.json({
      ...exhibition,
      artworks,
    })
  } catch (error) {
    console.error('[GET /api/exhibitions/by-url/[url]] error:', JSON.stringify(error, null, 2))
    return NextResponse.json({ error: 'Failed to fetch exhibition' }, { status: 500 })
  }
}

// Edit mode: always fresh, never cached
async function getEditModeResponse(url: string) {
  const exhibition = await prisma.exhibition.findUnique({
    where: { url },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          lastName: true,
          handler: true,
          biography: true,
        },
      },
      exhibitionArtworks: {
        include: {
          artwork: {
            select: {
              id: true,
              slug: true,
              name: true,
              title: true,
              author: true,
              year: true,
              technique: true,
              dimensions: true,
              imageUrl: true,
              artworkType: true,
              hiddenFromExhibition: true,
            },
          },
        },
      },
    },
  })

  if (!exhibition) {
    return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
  }

  // Check permissions for edit mode
  const session = await auth()
  const isOwner = session?.user?.id === exhibition.userId
  const userType = session?.user?.userType
  const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'

  if (!isOwner && !isAdminOrAbove) {
    return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
  }

  const artworks = exhibition.exhibitionArtworks
    .map((ea) => ea.artwork)
    .filter((artwork) => !artwork.hiddenFromExhibition)

  return NextResponse.json({
    ...exhibition,
    artworks,
  })
}
