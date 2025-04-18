import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { editArtwork } from '@/lib/features/artworksSlice'
import { updateArtworkPosition } from '@/lib/features/exhibitionSlice'

export const useArtworkHandlers = (currentArtworkId, boundingData) => {
  const dispatch = useDispatch()

  const positionsById = useSelector((state) => state.exhibition.positionsById)

  const sanitizeNumberInput = (value) => {
    const normalizedValue = value * 100
    return normalizedValue
  }

  const handleNameChange = (e) => {
    dispatch(
      editArtwork({
        currentArtworkId,
        property: 'name',
        value: e.target.value,
      }),
    )
  }

  const handleAlignChange = (alignment, wallWidth, wallHeight) => {
    const currentEdited = positionsById[currentArtworkId]

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

    const artworkPosition = {
      posX2d: newX,
      posY2d: newY,
    }

    const new3DCoordinate = convert2DTo3D(newX, newY, artworkWidth, artworkHeight, boundingData)

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { ...artworkPosition, ...new3DCoordinate },
      }),
    )
  }

  const handleMoveXChange = (e) => {
    const newX = sanitizeNumberInput(e.target.value)

    const currentEdited = positionsById[currentArtworkId]
    if (!currentEdited) return

    const artworkWidth = currentEdited.width2d
    const artworkHeight = currentEdited.height2d
    const artworkY = currentEdited.posY2d

    const new3DCoordinate = convert2DTo3D(
      newX,
      artworkY,

      artworkWidth,
      artworkHeight,

      boundingData,
    )

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { posX2d: newX, ...new3DCoordinate },
      }),
    )
  }

  const handleMoveYChange = (e) => {
    const newY = sanitizeNumberInput(e.target.value)

    const currentEdited = positionsById[currentArtworkId]
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

  const handleWidthChange = (e) => {
    const newWidth = sanitizeNumberInput(e.target.value)

    const currentEdited = positionsById[currentArtworkId]
    if (!currentEdited) return

    const x = currentEdited.artworkX
    const currentWidth = currentEdited.width2d

    const newX = x + (currentWidth - newWidth) / 2

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { width2d: newWidth, posX2d: newX },
      }),
    )
  }

  const handleHeightChange = (e) => {
    const newHeight = sanitizeNumberInput(e.target.value)

    const currentEdited = positionsById[currentArtworkId]
    if (!currentEdited) return

    const y = currentEdited.artworkY
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
