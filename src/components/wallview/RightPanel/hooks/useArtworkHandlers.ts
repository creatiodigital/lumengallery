import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Box3 } from 'three'

import { convert2DTo3D } from '@/components/wallview/utils'
import { editArtwork } from '@/redux/slices/artworksSlice'
import { updateArtworkPosition } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'
import type { TAlign } from '@/types/wizard'

type TBoundingData = TDimensions & {
  boundingBox: Box3
  normal: { x: number; y: number; z: number }
}

export const useArtworkHandlers = (currentArtworkId: string, boundingData: TBoundingData) => {
  const dispatch = useDispatch()

  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  const sanitizeNumberInput = (value: number | string): number => {
    const normalizedValue = Number(value) * 100
    return normalizedValue
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(
      editArtwork({
        currentArtworkId,
        property: 'name',
        value: e.target.value,
      }),
    )
  }

  const handleAlignChange = (alignment: TAlign, wallWidth: number, wallHeight: number) => {
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const artworkWidth = currentEdited.width2d
    const artworkHeight = currentEdited.height2d
    const artworkX = currentEdited.posX2d
    const artworkY = currentEdited.posY2d
    const factor = 100

    let newX = artworkX
    let newY = artworkY

    switch (alignment) {
      case 'horizontalLeft':
        newX = 0
        break
      case 'horizontalCenter':
        newX = (wallWidth * factor) / 2 - artworkWidth / 2
        break
      case 'horizontalRight':
        newX = wallWidth * factor - artworkWidth
        break
      case 'verticalTop':
        newY = 0
        break
      case 'verticalCenter':
        newY = (wallHeight * factor) / 2 - artworkHeight / 2
        break
      case 'verticalBottom':
        newY = wallHeight * factor - artworkHeight
        break
      default:
        break
    }

    const artworkPosition = { posX2d: newX, posY2d: newY }
    const new3DCoordinate = convert2DTo3D(newX, newY, artworkWidth, artworkHeight, boundingData)

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { ...artworkPosition, ...new3DCoordinate },
      }),
    )
  }

  const handleMoveXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newX = sanitizeNumberInput(e.target.value)
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const artworkWidth = currentEdited.width2d
    const artworkHeight = currentEdited.height2d
    const artworkY = currentEdited.posY2d

    const new3DCoordinate = convert2DTo3D(newX, artworkY, artworkWidth, artworkHeight, boundingData)

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { posX2d: newX, ...new3DCoordinate },
      }),
    )
  }

  const handleMoveYChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newY = sanitizeNumberInput(e.target.value)
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const artworkWidth = currentEdited.width2d
    const artworkHeight = currentEdited.height2d
    const artworkX = currentEdited.posX2d

    const new3DCoordinate = convert2DTo3D(artworkX, newY, artworkWidth, artworkHeight, boundingData)

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { posY2d: newY, ...new3DCoordinate },
      }),
    )
  }

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWidth = sanitizeNumberInput(e.target.value)
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const x = currentEdited.posX2d
    const currentWidth = currentEdited.width2d
    const newX = x + (currentWidth - newWidth) / 2

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { width2d: newWidth, posX2d: newX },
      }),
    )
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHeight = sanitizeNumberInput(e.target.value)
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const y = currentEdited.posY2d
    const currentHeight = currentEdited.height2d
    const newY = y + (currentHeight - newHeight) / 2

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { height2d: newHeight, posY2d: newY },
      }),
    )
  }

  return {
    handleNameChange,
    handleAlignChange,
    handleMoveXChange,
    handleMoveYChange,
    handleWidthChange,
    handleHeightChange,
  }
}
