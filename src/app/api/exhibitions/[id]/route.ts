import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { deleteFromR2 } from '@/lib/r2'

import { Prisma } from '@/generated/prisma'
import { auth } from '@/auth'
import { requireOwnership, isAdminOrAbove } from '@/lib/authUtils'
import prisma from '@/lib/prisma'
import { buildExhibitionSnapshot } from '@/lib/exhibitionSnapshot'

import { sanitizeLine } from '@/utils/sanitizeLine'
import { slugify } from '@/utils/slugify'

type ExhibitionUpdateBody = {
  mainTitle?: string
  url?: string
  description?: string
  shortDescription?: string
  status?: string // 'current' | 'past'
  published?: boolean
  previewEnabled?: boolean
  hasPendingChanges?: boolean
  thumbnailUrl?: string
  bannerUrl?: string
  startDate?: string
  endDate?: string
  // Lighting customization
  ambientLightColor?: string
  ambientLightIntensity?: number
  skylightColor?: string
  skylightIntensity?: number
  ceilingLampColor?: string
  ceilingLampIntensity?: number
  trackLampColor?: string
  trackLampIntensity?: number
  trackLampsVisible?: boolean
  recessedLampColor?: string
  recessedLampIntensity?: number
  recessedLampAngle?: number
  recessedLampDistance?: number
  trackLampMaterialColor?: string
  trackLampAngle?: number
  trackLampDistance?: number
  trackLampSettings?: Record<string, { rotation: number; enabled: boolean; offset?: number }> | null
  windowLightColor?: string
  windowLightIntensity?: number
  windowTransparency?: boolean
  hdriRotation?: number
  floorReflectiveness?: number
  floorMaterial?: string
  floorTextureScale?: number
  floorTextureOffsetX?: number
  floorTextureOffsetY?: number
  floorTemperature?: number
  floorNormalScale?: number
  floorRotation?: number
  // Camera settings
  cameraFOV?: number
  cameraElevation?: number
  hdriEnvironment?: string
  ceilingLightMode?: string

  // Wall & Ceiling
  wallColor?: string
  ceilingColor?: string
  wallBrightness?: number

  // Autofocus groups
  autofocusGroups?: Array<{ id: string; name: string; artworkIds: string[] }> | null

  // Shadow decal controls
  shadowBlur?: number
  shadowSpread?: number
  shadowOpacity?: number
  shadowDirection?: number
}

/* ------------------------ GET ------------------------ */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const exhibition = await prisma.exhibition.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastName: true,
            handler: true,
          },
        },
      },
    })

    if (!exhibition) {
      return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
    }

    // Draft (unpublished) exhibitions are visible only to their owner or an
    // admin. And the secret `previewToken` (which unlocks the preview page)
    // must never be returned to anyone else — the public visit path is
    // /api/exhibitions/by-url, which applies the same gate.
    const session = await auth()
    const viewerId = session?.impersonating?.id || session?.user?.id
    const isOwnerOrAdmin =
      isAdminOrAbove(session?.user?.userType) || (!!viewerId && viewerId === exhibition.userId)

    if (!exhibition.published && !isOwnerOrAdmin) {
      return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
    }

    if (!isOwnerOrAdmin) {
      const { previewToken: _previewToken, ...safe } = exhibition
      return NextResponse.json(safe)
    }

    return NextResponse.json(exhibition)
  } catch (error) {
    console.error('[GET /api/exhibitions/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to fetch exhibition' }, { status: 500 })
  }
}

/* ------------------------ PUT (requires auth + ownership) ------------------------ */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // Verify ownership before allowing update
    const currentExhibition = await prisma.exhibition.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!currentExhibition)
      return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
    const { error: authError } = await requireOwnership(currentExhibition.userId)
    if (authError) return authError

    const body = (await request.json()) as ExhibitionUpdateBody

    // Sanitize single-line text fields. `description` is rich-text
    // HTML — DOMPurify cleans at render. shortDescription is plain
    // text but multi-paragraph optional, so we still treat as a single
    // line for now (no newlines today; revisit if product asks).
    if (body.mainTitle !== undefined) body.mainTitle = sanitizeLine(String(body.mainTitle))
    if (body.url !== undefined) body.url = sanitizeLine(String(body.url))
    if (body.shortDescription !== undefined) {
      body.shortDescription = sanitizeLine(String(body.shortDescription))
    }
    if (
      (typeof body.mainTitle === 'string' && body.mainTitle.length > 200) ||
      (typeof body.url === 'string' && body.url.length > 200) ||
      (typeof body.shortDescription === 'string' && body.shortDescription.length > 500)
    ) {
      return NextResponse.json({ error: 'One or more fields are too long.' }, { status: 400 })
    }

    const data: Prisma.ExhibitionUpdateInput = {}
    if (body.mainTitle !== undefined) {
      data.mainTitle = body.mainTitle
      // Use custom URL if provided, otherwise auto-generate from title
      const newUrl = body.url ? slugify(body.url) : slugify(body.mainTitle)
      data.url = newUrl

      // Check if another exhibition by this user already uses this URL
      const conflict = await prisma.exhibition.findFirst({
        where: {
          userId: currentExhibition.userId,
          url: newUrl,
          id: { not: id },
        },
        select: { id: true },
      })
      if (conflict) {
        return NextResponse.json(
          { error: 'An exhibition with this name already exists' },
          { status: 409 },
        )
      }
    }
    if (body.description !== undefined) data.description = body.description
    if (body.shortDescription !== undefined) data.shortDescription = body.shortDescription
    if (body.status !== undefined) data.status = body.status
    if (body.thumbnailUrl !== undefined) data.thumbnailUrl = body.thumbnailUrl
    if (body.bannerUrl !== undefined) data.bannerUrl = body.bannerUrl
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate)
    if (body.endDate !== undefined) data.endDate = new Date(body.endDate)
    // Lighting customization
    if (body.ambientLightColor !== undefined) data.ambientLightColor = body.ambientLightColor
    if (body.ambientLightIntensity !== undefined)
      data.ambientLightIntensity = body.ambientLightIntensity
    if (body.skylightColor !== undefined) data.skylightColor = body.skylightColor
    if (body.skylightIntensity !== undefined) data.skylightIntensity = body.skylightIntensity
    if (body.ceilingLampColor !== undefined) data.ceilingLampColor = body.ceilingLampColor
    if (body.ceilingLampIntensity !== undefined)
      data.ceilingLampIntensity = body.ceilingLampIntensity
    if (body.trackLampColor !== undefined) data.trackLampColor = body.trackLampColor
    if (body.trackLampIntensity !== undefined) data.trackLampIntensity = body.trackLampIntensity
    if (body.trackLampsVisible !== undefined) data.trackLampsVisible = body.trackLampsVisible
    if (body.recessedLampColor !== undefined) data.recessedLampColor = body.recessedLampColor
    if (body.recessedLampIntensity !== undefined)
      data.recessedLampIntensity = body.recessedLampIntensity
    if (body.recessedLampAngle !== undefined)
      data.recessedLampAngle = Math.max(0.1, Math.min(1.2, body.recessedLampAngle))
    if (body.recessedLampDistance !== undefined)
      data.recessedLampDistance = Math.max(1, Math.min(20, body.recessedLampDistance))
    if (body.trackLampMaterialColor !== undefined)
      data.trackLampMaterialColor = body.trackLampMaterialColor
    if (body.trackLampAngle !== undefined)
      data.trackLampAngle = Math.max(0.1, Math.min(1.2, body.trackLampAngle))
    if (body.trackLampDistance !== undefined)
      data.trackLampDistance = Math.max(1, Math.min(10, body.trackLampDistance))
    if (body.trackLampSettings !== undefined)
      data.trackLampSettings =
        body.trackLampSettings === null ? Prisma.JsonNull : body.trackLampSettings
    if (body.windowLightColor !== undefined) data.windowLightColor = body.windowLightColor
    if (body.windowLightIntensity !== undefined)
      data.windowLightIntensity = body.windowLightIntensity
    if (body.windowTransparency !== undefined) data.windowTransparency = body.windowTransparency
    if (body.hdriRotation !== undefined) data.hdriRotation = body.hdriRotation
    if (body.floorReflectiveness !== undefined) data.floorReflectiveness = body.floorReflectiveness
    if (body.floorMaterial !== undefined) data.floorMaterial = body.floorMaterial
    if (body.floorTextureScale !== undefined) {
      // Clamp scale between 0.5 and 5.0
      data.floorTextureScale = Math.max(0.5, Math.min(8.0, body.floorTextureScale))
    }
    if (body.floorTextureOffsetX !== undefined) data.floorTextureOffsetX = body.floorTextureOffsetX
    if (body.floorTextureOffsetY !== undefined) data.floorTextureOffsetY = body.floorTextureOffsetY
    if (body.floorTemperature !== undefined) {
      // Clamp temperature between -1 (cool) and 1 (warm)
      data.floorTemperature = Math.max(-1, Math.min(1, body.floorTemperature))
    }
    if (body.floorNormalScale !== undefined) {
      // Clamp normal scale between 0 and 5.0
      data.floorNormalScale = Math.max(0, Math.min(5.0, body.floorNormalScale))
    }
    if (body.floorRotation !== undefined) {
      // Clamp rotation between 0 and 360 degrees
      data.floorRotation = ((body.floorRotation % 360) + 360) % 360
    }
    // Camera settings
    if (body.cameraFOV !== undefined) {
      // Clamp FOV between 40 and 60
      data.cameraFOV = Math.max(40, Math.min(60, body.cameraFOV))
    }
    if (body.cameraElevation !== undefined) {
      // Clamp elevation between 1.5 and 1.7 meters
      data.cameraElevation = Math.max(1.5, Math.min(1.7, body.cameraElevation))
    }

    if (body.hdriEnvironment !== undefined) data.hdriEnvironment = body.hdriEnvironment
    if (body.ceilingLightMode !== undefined) data.ceilingLightMode = body.ceilingLightMode

    // Wall & Ceiling
    if (body.wallColor !== undefined) data.wallColor = body.wallColor
    if (body.ceilingColor !== undefined) data.ceilingColor = body.ceilingColor
    if (body.wallBrightness !== undefined)
      data.wallBrightness = Math.max(1.0, Math.min(5.0, body.wallBrightness))

    // Autofocus groups
    if (body.autofocusGroups !== undefined)
      data.autofocusGroups = body.autofocusGroups === null ? Prisma.JsonNull : body.autofocusGroups

    // Shadow decal controls
    if (body.shadowBlur !== undefined)
      data.shadowBlur = Math.max(0.01, Math.min(0.08, body.shadowBlur))
    if (body.shadowSpread !== undefined)
      data.shadowSpread = Math.max(0.5, Math.min(3.0, body.shadowSpread))
    if (body.shadowOpacity !== undefined)
      data.shadowOpacity = Math.max(0.05, Math.min(0.8, body.shadowOpacity))
    if (body.shadowDirection !== undefined)
      data.shadowDirection = Math.max(0.0, Math.min(1.0, body.shadowDirection))

    // Preview toggle (only meaningful when unpublished)
    if (body.previewEnabled !== undefined) {
      data.previewEnabled = body.previewEnabled
      if (body.previewEnabled) {
        // Generate a unique preview token when enabling
        data.previewToken = crypto.randomUUID()
        // Build a snapshot so the preview link serves frozen data
        const snapshot = await buildExhibitionSnapshot(id)
        data.publishedSnapshot = snapshot
        data.hasPendingChanges = false
      } else {
        // Clear token and snapshot when disabling preview
        data.previewToken = null
        data.publishedSnapshot = Prisma.JsonNull
      }
    }

    // --- Draft/Publish logic ---
    if (body.published === true) {
      // Publishing or re-publishing: build snapshot from current state
      data.published = true
      const snapshot = await buildExhibitionSnapshot(id)
      data.publishedSnapshot = snapshot
      data.publishedAt = new Date()
      data.hasPendingChanges = false
    } else if (body.published === false) {
      // Unpublishing: clear snapshot
      data.published = false
      data.publishedSnapshot = Prisma.JsonNull
      data.publishedAt = null
      data.hasPendingChanges = false
    } else if (body.hasPendingChanges === false) {
      // Explicit clear of pending changes (e.g. "Update Exhibition" for preview)
      data.hasPendingChanges = false
      // Rebuild snapshot so the preview link reflects the latest state
      const exhibition = await prisma.exhibition.findUnique({
        where: { id },
        select: { previewEnabled: true },
      })
      if (exhibition?.previewEnabled) {
        const snapshot = await buildExhibitionSnapshot(id)
        data.publishedSnapshot = snapshot
      }
    } else {
      // Any other edit on a published or preview-enabled exhibition → mark as having pending changes
      const exhibition = await prisma.exhibition.findUnique({
        where: { id },
        select: { published: true, previewEnabled: true },
      })
      if (exhibition?.published || exhibition?.previewEnabled) {
        data.hasPendingChanges = true
      }
    }

    const updated = await prisma.exhibition.update({
      where: { id },
      data,
    })

    // Revalidate caches
    revalidateTag(`exhibition-${updated.url}`, 'default')
    if (
      body.published !== undefined ||
      body.mainTitle !== undefined ||
      data.hasPendingChanges !== undefined
    ) {
      revalidateTag('exhibitions', 'default')
      revalidatePath('/')
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PUT /api/exhibitions/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to update exhibition' }, { status: 500 })
  }
}

/* ------------------------ DELETE (requires auth + ownership) ------------------------ */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // Fetch the exhibition to verify ownership and get the featuredImageUrl
    const exhibition = await prisma.exhibition.findUnique({
      where: { id },
      select: { userId: true, featuredImageUrl: true },
    })

    if (!exhibition) return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })

    // Verify ownership
    const { error: authError } = await requireOwnership(exhibition.userId)
    if (authError) return authError
    if (exhibition?.featuredImageUrl) {
      try {
        await deleteFromR2(exhibition.featuredImageUrl)
      } catch (error) {
        console.warn('Failed to delete featured image blob:', error)
        // Continue anyway - the blob might not exist
      }
    }

    await prisma.exhibition.delete({ where: { id } })

    // Revalidate caches
    revalidateTag('exhibitions', 'default')
    revalidatePath('/')

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('[DELETE /api/exhibitions/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete exhibition' }, { status: 500 })
  }
}
