'use client'

import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { EditView } from '@/components/editview'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { useGLTF } from '@react-three/drei'
import { spaceConfigs } from '@/components/scene/constants'
import { preloadAllFloorMaterials } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'
import { useLoadExhibitionArtworks } from '@/hooks/useLoadExhibitionArtworks'
import { resetArtworks } from '@/redux/slices/artworkSlice'
import { useGetExhibitionByUrlQuery } from '@/redux/slices/exhibitionApi'
import { setExhibition } from '@/redux/slices/exhibitionSlice'
import { resetScene } from '@/redux/slices/sceneSlice'
import {
  resetWallView,
  showWallView,
  chooseCurrentArtworkId,
  addArtworkToGroup,
} from '@/redux/slices/wallViewSlice'
import { resetWizard, showWizard } from '@/redux/slices/wizardSlice'
import type { AppDispatch } from '@/redux/store'
import type { TExhibition } from '@/types/exhibition'

interface ExhibitionEditPageProps {
  artistSlug: string
  exhibitionSlug: string
  initialWallId?: string
  initialArtworkId?: string
}

export const ExhibitionEditPage = ({
  artistSlug: _artistSlug,
  exhibitionSlug,
  initialWallId,
  initialArtworkId,
}: ExhibitionEditPageProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const hasResetRef = useRef<string | null>(null)
  const hasRestoredStateRef = useRef<string | null>(null)

  // Edit view warms EVERY floor-material set so the artist gets instant
  // previews when switching floors. The visit page deliberately does not —
  // it preloads only the exhibition's own material (see view/index.tsx).
  useEffect(() => {
    preloadAllFloorMaterials()
  }, [])

  // Reset all exhibition-related state when page loads or exhibition changes
  // This ensures complete isolation between exhibitions
  useEffect(() => {
    // Only reset if this is a new exhibition or first load
    if (hasResetRef.current !== exhibitionSlug) {
      // Reset all Redux state
      dispatch(resetWallView())
      dispatch(resetScene())
      dispatch(resetArtworks())
      dispatch(resetWizard())

      // Clear GLTF cache for space types
      Object.values(spaceConfigs).forEach((config) => useGLTF.clear(config.gltfPath))

      hasResetRef.current = exhibitionSlug
      // Reset restored state ref when exhibition changes
      hasRestoredStateRef.current = null
    }
  }, [dispatch, exhibitionSlug])

  const {
    data: exhibition,
    isLoading,
    error,
  } = useGetExhibitionByUrlQuery(
    { url: exhibitionSlug, mode: 'edit' },
    {
      skip: !exhibitionSlug,
      refetchOnMountOrArgChange: true,
    },
  )

  useEffect(() => {
    if (exhibition) {
      // Convert API response to TExhibition format
      const exhibitionData: TExhibition = {
        id: exhibition.id,
        userId: exhibition.userId,
        name: exhibition.mainTitle,
        mainTitle: exhibition.mainTitle,
        url: exhibition.url,
        thumbnailUrl: exhibition.thumbnailUrl || '',
        spaceId: exhibition.spaceId,
        bannerUrl: exhibition.bannerUrl || '',
        startDate: exhibition.startDate || '',
        endDate: exhibition.endDate || '',
        exhibitionArtworksById: exhibition.exhibitionArtworksById || {},
        allExhibitionArtworkIds: exhibition.allExhibitionArtworkIds || [],
        status: exhibition.status,
        published: exhibition.published ?? false,
        hasPendingChanges: exhibition.hasPendingChanges ?? false,
        previewEnabled: exhibition.previewEnabled ?? false,
        // Lighting customization
        ambientLightColor: exhibition.ambientLightColor ?? undefined,
        ambientLightIntensity: exhibition.ambientLightIntensity ?? undefined,
        skylightColor: exhibition.skylightColor ?? undefined,
        skylightIntensity: exhibition.skylightIntensity ?? undefined,
        ceilingLampColor: exhibition.ceilingLampColor ?? undefined,
        ceilingLampIntensity: exhibition.ceilingLampIntensity ?? undefined,
        trackLampColor: exhibition.trackLampColor ?? undefined,
        trackLampIntensity: exhibition.trackLampIntensity ?? undefined,
        trackLampsVisible: exhibition.trackLampsVisible ?? undefined,
        trackLampAngle: exhibition.trackLampAngle ?? undefined,
        trackLampDistance: exhibition.trackLampDistance ?? undefined,
        trackLampSettings: exhibition.trackLampSettings ?? undefined,
        ceilingLightMode: exhibition.ceilingLightMode ?? undefined,
        recessedLampColor: exhibition.recessedLampColor ?? undefined,
        recessedLampIntensity: exhibition.recessedLampIntensity ?? undefined,
        recessedLampAngle: exhibition.recessedLampAngle ?? undefined,
        recessedLampDistance: exhibition.recessedLampDistance ?? undefined,
        trackLampMaterialColor: exhibition.trackLampMaterialColor ?? undefined,
        windowLightColor: exhibition.windowLightColor ?? undefined,
        windowLightIntensity: exhibition.windowLightIntensity ?? undefined,
        windowTransparency: exhibition.windowTransparency ?? undefined,
        hdriRotation: exhibition.hdriRotation ?? undefined,
        // Floor customization
        floorReflectiveness: exhibition.floorReflectiveness ?? undefined,
        floorMaterial: exhibition.floorMaterial ?? undefined,
        floorTextureScale: exhibition.floorTextureScale ?? undefined,
        floorTextureOffsetX: exhibition.floorTextureOffsetX ?? undefined,
        floorTextureOffsetY: exhibition.floorTextureOffsetY ?? undefined,
        floorTemperature: exhibition.floorTemperature ?? undefined,
        floorNormalScale: exhibition.floorNormalScale ?? undefined,
        floorRotation: exhibition.floorRotation ?? undefined,
        // HDRI
        hdriEnvironment: exhibition.hdriEnvironment ?? undefined,
        // Camera settings
        cameraFOV: exhibition.cameraFOV ?? undefined,
        cameraElevation: exhibition.cameraElevation ?? undefined,
        // Wall & Ceiling
        wallColor: exhibition.wallColor ?? undefined,
        ceilingColor: exhibition.ceilingColor ?? undefined,
        // Autofocus groups
        autofocusGroups: exhibition.autofocusGroups ?? undefined,
      }
      dispatch(setExhibition(exhibitionData))
    }
  }, [exhibition, dispatch])

  // Load saved artworks from database
  const { isReady: artworksReady } = useLoadExhibitionArtworks(exhibition?.id, 'edit')

  // Restore wall view state from URL params (when returning from artwork edit)
  // Wait for artworks to be loaded before restoring
  useEffect(() => {
    if (
      exhibition &&
      artworksReady &&
      initialWallId &&
      hasRestoredStateRef.current !== exhibitionSlug &&
      hasResetRef.current === exhibitionSlug
    ) {
      dispatch(showWallView(initialWallId))

      if (initialArtworkId) {
        dispatch(chooseCurrentArtworkId(initialArtworkId))
        dispatch(addArtworkToGroup(initialArtworkId))
        dispatch(showWizard())
      }

      hasRestoredStateRef.current = exhibitionSlug
    }
  }, [exhibition, artworksReady, initialWallId, initialArtworkId, dispatch, exhibitionSlug])

  // Redirect to home if not logged in
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [sessionStatus, router])

  // Check ownership: user must own the exhibition OR be an admin/superAdmin
  useEffect(() => {
    if (sessionStatus === 'authenticated' && exhibition) {
      const isOwner = session?.user?.id === exhibition.userId
      const userType = session?.user?.userType
      const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'

      if (!isOwner && !isAdminOrAbove) {
        router.push('/dashboard')
      }
    }
  }, [sessionStatus, session, exhibition, router])

  // Show loading while checking session or if unauthenticated (redirect pending)
  if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated') {
    return <LoadingBar />
  }

  if (isLoading) {
    return <LoadingBar />
  }

  if (error) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        Error loading exhibition
      </div>
    )
  }

  if (!exhibition) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        Exhibition not found
      </div>
    )
  }

  // Final ownership check before rendering
  const isOwner = session?.user?.id === exhibition.userId
  const userType = session?.user?.userType
  const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'

  if (!isOwner && !isAdminOrAbove) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        Not authorized
      </div>
    )
  }

  return <EditView />
}
