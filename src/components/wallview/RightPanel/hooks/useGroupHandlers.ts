import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Box3 } from 'three'

import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition } from '@/redux/slices/exhibitionSlice'
import { editArtworkGroup } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'
import type { TAlign } from '@/types/wizard'

type TBoundingData = TDimensions & {
  boundingBox: Box3
  normal: { x: number; y: number; z: number }
}

export const useGroupHandlers = (artworkGroupIds: string[], boundingData: TBoundingData) => {
  const dispatch = useDispatch()
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const artworkGroup = useSelector((state: RootState) => state.wallView.artworkGroup)

  const handleMoveGroupXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGroupX = Number(e.target.value) * 100
    const deltaX = newGroupX - artworkGroup.groupX

    dispatch(editArtworkGroup({ groupX: newGroupX, groupY: artworkGroup.groupY }))

    artworkGroupIds.forEach((artworkId) => {
      const artwork = exhibitionArtworksById[artworkId]

      if (artwork) {
        const posX2d = artwork.posX2d + deltaX
        const posY2d = artwork.posY2d
        const width2d = artwork.width2d
        const height2d = artwork.height2d

        const artworkPosition = {
          posX2d,
          posY2d,
          width2d,
          height2d,
        }

        const new3DCoordinate = convert2DTo3D(posX2d, posY2d, width2d, height2d, boundingData)

        dispatch(
          updateArtworkPosition({
            artworkId: artworkId,
            artworkPosition: { ...artworkPosition, ...new3DCoordinate },
          }),
        )
      }
    })
  }

  const handleMoveGroupYChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGroupY = Number(e.target.value) * 100
    const deltaY = newGroupY - artworkGroup.groupY

    dispatch(editArtworkGroup({ groupX: artworkGroup.groupX, groupY: newGroupY }))

    artworkGroupIds.forEach((artworkId) => {
      const artwork = exhibitionArtworksById[artworkId]

      if (artwork) {
        const posX2d = artwork.posX2d
        const posY2d = artwork.posY2d + deltaY
        const width2d = artwork.width2d
        const height2d = artwork.height2d

        const artworkPosition = {
          posX2d,
          posY2d,
          width2d,
          height2d,
        }

        const new3DCoordinate = convert2DTo3D(posX2d, posY2d, width2d, height2d, boundingData)

        dispatch(
          updateArtworkPosition({
            artworkId: artworkId,
            artworkPosition: { ...artworkPosition, ...new3DCoordinate },
          }),
        )
      }
    })
  }

  const alignGroupToWall = (alignment: TAlign) => {
    if (!wallHeight || !wallWidth) {
      console.warn('Wall dimensions are not available, cannot align group.')
      return
    }
    let newGroupX = artworkGroup.groupX
    let newGroupY = artworkGroup.groupY

    switch (alignment) {
      case 'verticalTop':
        newGroupY = 0
        break
      case 'verticalCenter':
        newGroupY = (wallHeight * 100) / 2 - artworkGroup.groupHeight / 2
        break
      case 'verticalBottom':
        newGroupY = wallHeight * 100 - artworkGroup.groupHeight
        break
      case 'horizontalLeft':
        newGroupX = 0
        break
      case 'horizontalCenter':
        newGroupX = (wallWidth * 100) / 2 - artworkGroup.groupWidth / 2
        break
      case 'horizontalRight':
        newGroupX = wallWidth * 100 - artworkGroup.groupWidth
        break
      default:
        console.warn('Invalid alignment type:', alignment)
        return
    }

    dispatch(editArtworkGroup({ groupX: newGroupX, groupY: newGroupY }))

    const deltaX = newGroupX - artworkGroup.groupX
    const deltaY = newGroupY - artworkGroup.groupY

    artworkGroupIds.forEach((artworkId) => {
      const artwork = exhibitionArtworksById[artworkId]

      if (artwork) {
        const posX2d = artwork.posX2d + deltaX
        const posY2d = artwork.posY2d + deltaY
        const width2d = artwork.width2d
        const height2d = artwork.height2d

        const artworkPosition = {
          posX2d,
          posY2d,
          width2d,
          height2d,
        }

        const new3DCoordinate = convert2DTo3D(posX2d, posY2d, width2d, height2d, boundingData)

        dispatch(
          updateArtworkPosition({
            artworkId: artworkId,
            artworkPosition: { ...artworkPosition, ...new3DCoordinate },
          }),
        )
      }
    })
  }

  return {
    handleMoveGroupXChange,
    handleMoveGroupYChange,
    alignGroupToWall,
  }
}
