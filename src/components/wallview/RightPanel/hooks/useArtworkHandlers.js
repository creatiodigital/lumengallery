import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D, convert2DTo3DE } from '@/components/wallview/utils'
import { editArtworkSpace, editArtworkCanvas, editArtwork } from '@/lib/features/artworksSlice'
import { updateArtworkPosition } from '@/lib/features/exhibitionSlice'

export const useArtworkHandlers = (currentArtworkId, boundingData) => {
  const dispatch = useDispatch()

  const artworksById = useSelector((state) => state.artworks.byId)
  const artworksByIdE = useSelector((state) => state.exhibition.artworksById)

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
    const currentEdited = artworksById[currentArtworkId]
    const currentEditedE = artworksByIdE[currentArtworkId]

    if (!currentEdited) return

    const artworkWidth = currentEdited.canvas.width || currentEditedE.width2d
    const artworkHeight = currentEdited.canvas.height || currentEditedE.height2d
    //REFACTOR LATER
    const artworkX = currentEdited.canvas.x || currentEditedE.posX2d
    const artworkY = currentEdited.canvas.y || currentEditedE.posY2d

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

    const artworkPosition = { x: newX, y: newY }

    //REMOVE LATER
    dispatch(
      editArtworkCanvas({
        currentArtworkId,
        canvasUpdates: artworkPosition,
      }),
    )

    const new3DCoordinate = convert2DTo3D(
      {
        x: newX,
        y: newY,
        size: {
          w: artworkWidth,
          h: artworkHeight,
        },
      },
      boundingData,
    )

    const artworkPositionE = {
      posX2d: newX,
      posY2d: newY,
    }

    const new3DCoordinateE = convert2DTo3DE(
      {
        x: newX,
        y: newY,
        size: {
          w: artworkWidth,
          h: artworkHeight,
        },
      },
      boundingData,
    )

    dispatch(
      editArtworkSpace({
        currentArtworkId,
        spaceUpdates: new3DCoordinate,
      }),
    )

    // REFACTOR THIS SO WE SEND 2D and 3D at the same time
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { ...artworkPositionE, ...new3DCoordinateE },
      }),
    )
  }

  const handleMoveXChange = (e) => {
    const newX = sanitizeNumberInput(e.target.value)

    const currentEdited = artworksById[currentArtworkId]
    if (!currentEdited) return

    const artworkWidth = currentEdited.canvas.width
    const artworkHeight = currentEdited.canvas.height
    const artworkY = currentEdited.canvas.y

    dispatch(
      editArtworkCanvas({
        currentArtworkId,
        canvasUpdates: { ...currentEdited.canvas, x: newX },
      }),
    )

    const new3DCoordinate = convert2DTo3D(
      {
        x: newX,
        y: artworkY,
        size: {
          w: artworkWidth,
          h: artworkHeight,
        },
      },
      boundingData,
    )

    dispatch(
      editArtworkSpace({
        currentArtworkId,
        spaceUpdates: new3DCoordinate,
      }),
    )
  }

  const handleMoveYChange = (e) => {
    const newY = sanitizeNumberInput(e.target.value)

    const currentEdited = artworksById[currentArtworkId]
    if (!currentEdited) return

    const artworkWidth = currentEdited.canvas.width
    const artworkHeight = currentEdited.canvas.height
    const artworkX = currentEdited.canvas.x

    dispatch(
      editArtworkCanvas({
        currentArtworkId,
        canvasUpdates: { ...currentEdited.canvas, y: newY },
      }),
    )

    if (boundingData) {
      const new3DCoordinate = convert2DTo3D(
        {
          x: artworkX,
          y: newY,
          size: {
            w: artworkWidth,
            h: artworkHeight,
          },
        },
        boundingData,
      )

      dispatch(
        editArtworkSpace({
          currentArtworkId,
          spaceUpdates: new3DCoordinate,
        }),
      )
    }
  }

  const handleWidthChange = (e) => {
    const newWidth = sanitizeNumberInput(e.target.value)

    const currentEdited = artworksById[currentArtworkId]
    if (!currentEdited) return

    const { x, width: currentWidth } = currentEdited.canvas
    const newX = x + (currentWidth - newWidth) / 2

    dispatch(
      editArtworkCanvas({
        currentArtworkId,
        canvasUpdates: { ...currentEdited.canvas, width: newWidth, x: newX },
      }),
    )
  }

  const handleHeightChange = (e) => {
    const newHeight = sanitizeNumberInput(e.target.value)

    const currentEdited = artworksById[currentArtworkId]
    if (!currentEdited) return

    const { y, height: currentHeight } = currentEdited.canvas
    const newY = y + (currentHeight - newHeight) / 2

    dispatch(
      editArtworkCanvas({
        currentArtworkId,
        canvasUpdates: { ...currentEdited.canvas, height: newHeight, y: newY },
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
