import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'

import { convert2DTo3D } from '@/components/wallview/utils'
import { createArtwork } from '@/redux/slices/artworksSlice'
import { createArtworkPosition } from '@/redux/slices/exhibitionSlice'
import {
  chooseCurrentArtworkId,
  addArtworkToGroup,
  removeGroup,
} from '@/redux/slices/wallViewSlice'
import { showWizard } from '@/redux/slices/wizardSlice'
import type { RootState } from '@/redux/store'
import type { TArtworkKind } from '@/types/artwork'
import type { TDimensions } from '@/types/geometry'

export const useCreateArtwork = (boundingData: TDimensions, currentWallId: string | null) => {
  const dispatch = useDispatch()
  const initialSize = 100

  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)

  const handleCreateArtwork = useCallback(
    (artworkType: TArtworkKind) => {
      if (!boundingData || !wallWidth || !wallHeight) return

      const posX2d = (wallWidth * 100) / 2 - initialSize / 2
      const posY2d = (wallHeight * 100) / 2 - initialSize / 2

      const artworkId = uuidv4()

      dispatch(showWizard())
      dispatch(chooseCurrentArtworkId(artworkId))

      dispatch(
        createArtwork({
          id: artworkId,
          artworkType,
          wallId: currentWallId ?? '',
        }),
      )

      dispatch(removeGroup())
      dispatch(addArtworkToGroup(artworkId))

      const artworkPosition = {
        posX2d,
        posY2d,
        width2d: 100,
        height2d: 100,
      }

      const new3DCoordinate = convert2DTo3D(posX2d, posY2d, 100, 100, boundingData)

      dispatch(
        createArtworkPosition({
          artworkId,
          artworkPosition: {
            id: artworkId,
            wallId: currentWallId ?? '',
            ...artworkPosition,
            ...new3DCoordinate,
          },
        }),
      )
    },
    [boundingData, wallWidth, wallHeight, dispatch, currentWallId, initialSize],
  )

  const handleCreateArtworkDrag = useCallback(
    (artworkType: TArtworkKind, posX2d: number, posY2d: number) => {
      if (!boundingData) return

      const adjustedX = posX2d - initialSize / 2
      const adjustedY = posY2d - initialSize / 2

      const artworkId = uuidv4()

      dispatch(showWizard())
      dispatch(chooseCurrentArtworkId(artworkId))

      dispatch(
        createArtwork({
          id: artworkId,
          artworkType,
          wallId: currentWallId ?? '',
        }),
      )

      dispatch(removeGroup())
      dispatch(addArtworkToGroup(artworkId))

      const artworkPosition = {
        posX2d: adjustedX,
        posY2d: adjustedY,
        width2d: initialSize,
        height2d: initialSize,
      }

      const new3DCoordinate = convert2DTo3D(
        adjustedX,
        adjustedY,
        initialSize,
        initialSize,
        boundingData,
      )

      dispatch(
        createArtworkPosition({
          artworkId,
          artworkPosition: { ...artworkPosition, ...new3DCoordinate },
        }),
      )
    },
    [boundingData, dispatch, currentWallId, initialSize],
  )

  return useMemo(
    () => ({
      handleCreateArtwork,
      handleCreateArtworkDrag,
    }),
    [handleCreateArtwork, handleCreateArtworkDrag],
  )
}
