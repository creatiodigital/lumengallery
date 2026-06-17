import { useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { WALL_SCALE } from '@/components/wallview/constants'
import { convert2DTo3D } from '@/components/wallview/utils'
import { createNewArtwork } from '@/factories/artworkFactory'
import { restoreArtwork } from '@/redux/slices/artworkSlice'
import { createArtworkPosition } from '@/redux/slices/exhibitionSlice'
import {
  chooseCurrentArtworkId,
  addArtworkToGroup,
  removeGroup,
} from '@/redux/slices/wallViewSlice'
import { showWizard } from '@/redux/slices/wizardSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork, TArtworkKind, TArtworkPosition } from '@/types/artwork'
import type { TDimensions } from '@/types/geometry'

export const useAddExistingArtwork = (boundingData: TDimensions | null) => {
  const dispatch = useDispatch()

  // Inline duplicate-guard error, surfaced via the consuming panel UI
  // (replaces the former native alert()).
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const clearDuplicateError = useCallback(() => setDuplicateError(null), [])

  const sizeForType = (type: string) => (type === 'sound' ? WALL_SCALE * 0.1 : WALL_SCALE * 0.25)

  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)
  const currentWallId = useSelector((s: RootState) => s.wallView.currentWallId)

  // Get artworks already in this exhibition (across all walls)
  const exhibitionArtworkIds = useSelector((state: RootState) => state.artworks.allIds)

  // Check if artwork already exists in exhibition
  const isArtworkInExhibition = useCallback(
    (artworkId: string) => exhibitionArtworkIds.includes(artworkId),
    [exhibitionArtworkIds],
  )

  // Add existing artwork at center
  const handleAddExistingArtwork = useCallback(
    async (artworkId: string): Promise<boolean> => {
      // Fresh attempt: clear any lingering duplicate error.
      setDuplicateError(null)

      // Check for duplicates
      if (isArtworkInExhibition(artworkId)) {
        setDuplicateError('This artwork already exists in your exhibition.')
        return false
      }

      if (!boundingData || !wallWidth || !wallHeight || !currentWallId) return false

      // Fetch artwork data from API
      const response = await fetch(`/api/artworks/${artworkId}`)
      if (!response.ok) {
        console.error('Failed to fetch artwork')
        return false
      }
      const artworkData = await response.json()

      const size = sizeForType(artworkData.artworkType)
      const posX2d = (wallWidth * WALL_SCALE) / 2 - size / 2
      const posY2d = (wallHeight * WALL_SCALE) / 2 - size / 2

      // Re-adding from library wipes per-exhibition presentation (frame, passepartout,
      // paper border, support…). Start from factory defaults, then layer on the
      // metadata returned by the API.
      const artwork: TArtwork = {
        ...createNewArtwork({
          id: artworkData.id,
          artworkType: artworkData.artworkType as TArtworkKind,
        }),
        name: artworkData.name,
        artworkTitle: artworkData.title || undefined,
        author: artworkData.author || undefined,
        artworkYear: artworkData.year || undefined,
        artworkDimensions: artworkData.dimensions || undefined,
        description: artworkData.description || undefined,
        imageUrl: artworkData.imageUrl || undefined,
        textContent: artworkData.textContent || undefined,
        soundUrl: artworkData.soundUrl || undefined,
        videoUrl: artworkData.videoUrl || undefined,
      }

      dispatch(restoreArtwork(artwork))
      dispatch(showWizard())
      dispatch(chooseCurrentArtworkId(artworkId))
      dispatch(removeGroup())
      dispatch(addArtworkToGroup(artworkId))

      const new3DCoordinate = convert2DTo3D(posX2d, posY2d, size, size, boundingData)

      const artworkPosition: TArtworkPosition = {
        id: artworkId,
        artworkId,
        wallId: currentWallId,
        posX2d,
        posY2d,
        width2d: size,
        height2d: size,
        ...new3DCoordinate,
      }

      dispatch(createArtworkPosition({ artworkId, artworkPosition }))
      return true
    },
    [boundingData, wallWidth, wallHeight, dispatch, currentWallId, isArtworkInExhibition],
  )

  // Add existing artwork at specific position (for drag-drop)
  const handleAddExistingArtworkDrag = useCallback(
    async (artworkId: string, posX2d: number, posY2d: number): Promise<boolean> => {
      // Fresh attempt: clear any lingering duplicate error.
      setDuplicateError(null)

      // Check for duplicates
      if (isArtworkInExhibition(artworkId)) {
        setDuplicateError('This artwork already exists in your exhibition.')
        return false
      }

      if (!boundingData || !currentWallId) return false

      // Fetch artwork data from API
      const response = await fetch(`/api/artworks/${artworkId}`)
      if (!response.ok) {
        console.error('Failed to fetch artwork')
        return false
      }
      const artworkData = await response.json()

      const size = sizeForType(artworkData.artworkType)
      const adjustedX = posX2d - size / 2
      const adjustedY = posY2d - size / 2

      // Re-adding from library wipes per-exhibition presentation (frame, passepartout,
      // paper border, support…). Start from factory defaults, then layer on the
      // metadata returned by the API.
      const artwork: TArtwork = {
        ...createNewArtwork({
          id: artworkData.id,
          artworkType: artworkData.artworkType as TArtworkKind,
        }),
        name: artworkData.name,
        artworkTitle: artworkData.title || undefined,
        author: artworkData.author || undefined,
        artworkYear: artworkData.year || undefined,
        artworkDimensions: artworkData.dimensions || undefined,
        description: artworkData.description || undefined,
        imageUrl: artworkData.imageUrl || undefined,
        textContent: artworkData.textContent || undefined,
        soundUrl: artworkData.soundUrl || undefined,
        videoUrl: artworkData.videoUrl || undefined,
      }

      dispatch(restoreArtwork(artwork))
      dispatch(showWizard())
      dispatch(chooseCurrentArtworkId(artworkId))
      dispatch(removeGroup())
      dispatch(addArtworkToGroup(artworkId))

      const new3DCoordinate = convert2DTo3D(adjustedX, adjustedY, size, size, boundingData)

      const artworkPosition: TArtworkPosition = {
        id: artworkId,
        artworkId,
        wallId: currentWallId,
        posX2d: adjustedX,
        posY2d: adjustedY,
        width2d: size,
        height2d: size,
        ...new3DCoordinate,
      }

      dispatch(createArtworkPosition({ artworkId, artworkPosition }))
      return true
    },
    [boundingData, dispatch, currentWallId, isArtworkInExhibition],
  )

  return {
    handleAddExistingArtwork,
    handleAddExistingArtworkDrag,
    isArtworkInExhibition,
    duplicateError,
    clearDuplicateError,
  }
}
