import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'

import { convert2DTo3D } from '@/components/wallview/utils'
import { createArtwork } from '@/app/redux/slices/artworksSlice'
import { createArtworkPosition } from '@/app/redux/slices/exhibitionSlice'
import {
  chooseCurrentArtworkId,
  addArtworkToGroup,
  removeGroup,
} from '@/app/redux/slices/wallViewSlice'
import { showWizard } from '@/app/redux/slices/wizardSlice'

export const useCreateArtwork = (boundingData, currentWallId) => {
  const dispatch = useDispatch()
  const initialSize = 100

  const wallWidth = useSelector((state) => state.wallView.wallWidth)
  const wallHeight = useSelector((state) => state.wallView.wallHeight)

  const handleCreateArtwork = useCallback(
    (artworkType) => {
      if (!boundingData) return

      const posX2d = (wallWidth * 100) / 2 - initialSize / 2
      const posY2d = (wallHeight * 100) / 2 - initialSize / 2

      const artworkId = uuidv4()

      dispatch(showWizard())
      dispatch(chooseCurrentArtworkId(artworkId))

      dispatch(
        createArtwork({
          id: artworkId,
          artworkType,
          wallId: currentWallId,
          imageURL: null,
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
            wallId: currentWallId,
            ...artworkPosition,
            ...new3DCoordinate,
          },
        }),
      )
    },
    [boundingData, wallWidth, wallHeight, dispatch, currentWallId, initialSize],
  )

  const handleCreateArtworkDrag = useCallback(
    (artworkType, posX2d, posY2d) => {
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
          wallId: currentWallId,
          imageURL: null,
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
