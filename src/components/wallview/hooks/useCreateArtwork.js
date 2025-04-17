import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'

import { convert2DTo3D, convert2DTo3DE } from '@/components/wallview/utils'
import { createArtwork, editArtworkSpace } from '@/lib/features/artworksSlice'
import { createArtworkPosition } from '@/lib/features/exhibitionSlice'
import {
  chooseCurrentArtworkId,
  addArtworkToGroup,
  removeGroup,
} from '@/lib/features/wallViewSlice'
import { showWizard } from '@/lib/features/wizardSlice'

export const useCreateArtwork = (boundingData, currentWallId) => {
  const dispatch = useDispatch()
  const initialSize = 100

  const wallWidth = useSelector((state) => state.wallView.wallWidth)
  const wallHeight = useSelector((state) => state.wallView.wallHeight)

  const handleCreateArtwork = useCallback(
    (artworkType) => {
      if (!boundingData) return

      const x = (wallWidth * 100) / 2 - initialSize / 2
      const y = (wallHeight * 100) / 2 - initialSize / 2

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
          canvas: {
            x,
            y,
            width: 100,
            height: 100,
          },
          imageURL: null,
        }),
      )

      const new3DCoordinate = convert2DTo3D(
        {
          x,
          y,
          size: {
            w: 100,
            h: 100,
          },
        },
        boundingData,
      )

      dispatch(removeGroup())
      dispatch(addArtworkToGroup(artworkId))

      const artworkPositionE = {
        posX2d,
        posY2d,
        width2d: 100,
        height2d: 100,
      }

      const new3DCoordinateE = convert2DTo3DE(
        {
          x,
          y,
          size: {
            w: 100,
            h: 100,
          },
        },
        boundingData,
      )

      dispatch(
        createArtworkPosition({
          artworkId,
          artworkPosition: { ...artworkPositionE, ...new3DCoordinateE },
        }),
      )

      dispatch(
        editArtworkSpace({
          currentArtworkId: artworkId,
          spaceUpdates: new3DCoordinate,
        }),
      )
    },
    [boundingData, wallWidth, wallHeight, dispatch, currentWallId, initialSize],
  )

  const handleCreateArtworkDrag = useCallback(
    (artworkType, x, y) => {
      if (!boundingData) return

      console.log('here')

      const adjustedX = x - initialSize / 2
      const adjustedY = y - initialSize / 2

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

      const artworkPositionE = {
        posX2d: adjustedX,
        posY2d: adjustedY,
        width2d: initialSize,
        height2d: initialSize,
      }

      const new3DCoordinateE = convert2DTo3DE(
        {
          x: adjustedX,
          y: adjustedY,
          size: {
            w: initialSize,
            h: initialSize,
          },
        },
        boundingData,
      )

      dispatch(
        createArtworkPosition({
          artworkId,
          artworkPosition: { ...artworkPositionE, ...new3DCoordinateE },
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
