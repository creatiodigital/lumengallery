import { useDispatch, useSelector } from 'react-redux'

import { WALL_SCALE, getArtworkBorderPx } from '@/components/wallview/constants'
import { Box3 } from 'three'

import { convert2DTo3D } from '@/components/wallview/utils'
import { editArtwork } from '@/redux/slices/artworkSlice'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
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
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)

  const sanitizeNumberInput = (value: number | string): number => {
    const normalizedValue = Number(value) * WALL_SCALE
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

  const artworksById = useSelector((state: RootState) => state.artworks.byId)

  const handleAlignChange = (alignment: TAlign, wallWidth: number, wallHeight: number) => {
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const artworkWidth = currentEdited.width2d
    const artworkHeight = currentEdited.height2d
    const artworkX = currentEdited.posX2d
    const artworkY = currentEdited.posY2d

    // Calculate frame + passepartout border in 2D pixels
    const art = artworksById[currentArtworkId]
    const borderOffset = getArtworkBorderPx(art)

    // For rotated shapes, compute the AABB offset so alignment respects the full rotated extent
    const rotationDeg = art?.artworkType === 'shape' ? (currentEdited.rotation ?? 0) : 0
    const rotationRad = (rotationDeg * Math.PI) / 180
    let aabbOffsetX = 0
    let aabbOffsetY = 0
    if (rotationDeg !== 0) {
      const cosA = Math.abs(Math.cos(rotationRad))
      const sinA = Math.abs(Math.sin(rotationRad))
      const aabbWidth = artworkWidth * cosA + artworkHeight * sinA
      const aabbHeight = artworkWidth * sinA + artworkHeight * cosA
      aabbOffsetX = (aabbWidth - artworkWidth) / 2
      aabbOffsetY = (aabbHeight - artworkHeight) / 2
    }

    let newX = artworkX
    let newY = artworkY

    switch (alignment) {
      case 'horizontalLeft':
        newX = borderOffset + aabbOffsetX
        break
      case 'horizontalCenter':
        newX = (wallWidth * WALL_SCALE) / 2 - artworkWidth / 2
        break
      case 'horizontalRight':
        newX = wallWidth * WALL_SCALE - artworkWidth - borderOffset - aabbOffsetX
        break
      case 'verticalTop':
        newY = borderOffset + aabbOffsetY
        break
      case 'verticalCenter':
        newY = (wallHeight * WALL_SCALE) / 2 - artworkHeight / 2
        break
      case 'verticalBottom':
        newY = wallHeight * WALL_SCALE - artworkHeight - borderOffset - aabbOffsetY
        break
      default:
        break
    }

    const artworkPosition = { posX2d: newX, posY2d: newY }
    const new3DCoordinate = convert2DTo3D(newX, newY, artworkWidth, artworkHeight, boundingData)

    dispatch(pushToHistory()) // Save state before alignment change
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { ...artworkPosition, ...new3DCoordinate },
      }),
    )
  }

  // Handler for "from left" input - distance from left wall edge to artwork center
  const handleFromLeftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fromLeft = sanitizeNumberInput(e.target.value)
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const artworkWidth = currentEdited.width2d
    const artworkHeight = currentEdited.height2d
    const artworkY = currentEdited.posY2d
    // fromLeft is distance from left edge to center, so top-left X = fromLeft - width/2
    const newX = fromLeft - artworkWidth / 2
    const new3DCoordinate = convert2DTo3D(newX, artworkY, artworkWidth, artworkHeight, boundingData)

    dispatch(pushToHistory())
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { posX2d: newX, ...new3DCoordinate },
      }),
    )
  }

  // Handler for "from right" input - distance from right wall edge to artwork center
  const handleFromRightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fromRight = sanitizeNumberInput(e.target.value)
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const artworkWidth = currentEdited.width2d
    const artworkHeight = currentEdited.height2d
    const artworkY = currentEdited.posY2d
    const wallWidth2d = (wallWidth || 0) * WALL_SCALE
    // fromRight = wallWidth - centerX, so centerX = wallWidth - fromRight
    const centerX = wallWidth2d - fromRight
    const newX = centerX - artworkWidth / 2
    const new3DCoordinate = convert2DTo3D(newX, artworkY, artworkWidth, artworkHeight, boundingData)

    dispatch(pushToHistory())
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { posX2d: newX, ...new3DCoordinate },
      }),
    )
  }

  // Handler for "from top" input - distance from top wall edge to artwork center
  const handleFromTopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fromTop = sanitizeNumberInput(e.target.value)
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const artworkWidth = currentEdited.width2d
    const artworkHeight = currentEdited.height2d
    const artworkX = currentEdited.posX2d
    // fromTop is distance from top to center, so top-left Y = fromTop - height/2
    const newY = fromTop - artworkHeight / 2
    const new3DCoordinate = convert2DTo3D(artworkX, newY, artworkWidth, artworkHeight, boundingData)

    dispatch(pushToHistory())
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { posY2d: newY, ...new3DCoordinate },
      }),
    )
  }

  // Handler for "from bottom" input - distance from bottom wall edge to artwork center
  const handleFromBottomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fromBottom = sanitizeNumberInput(e.target.value)
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const artworkWidth = currentEdited.width2d
    const artworkHeight = currentEdited.height2d
    const artworkX = currentEdited.posX2d
    const wallHeight2d = (wallHeight || 0) * WALL_SCALE
    // fromBottom = wallHeight - centerY, so centerY = wallHeight - fromBottom
    const centerY = wallHeight2d - fromBottom
    const newY = centerY - artworkHeight / 2
    const new3DCoordinate = convert2DTo3D(artworkX, newY, artworkWidth, artworkHeight, boundingData)

    dispatch(pushToHistory())
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { posY2d: newY, ...new3DCoordinate },
      }),
    )
  }

  const handleWidthChange = (widthMeters: number) => {
    const newWidth = widthMeters * WALL_SCALE
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const x = currentEdited.posX2d
    const currentWidth = currentEdited.width2d
    const newX = x + (currentWidth - newWidth) / 2

    const new3DCoordinate = convert2DTo3D(
      newX,
      currentEdited.posY2d,
      newWidth,
      currentEdited.height2d,
      boundingData,
    )

    dispatch(pushToHistory())
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { width2d: newWidth, posX2d: newX, ...new3DCoordinate },
      }),
    )
  }

  const handleHeightChange = (heightMeters: number) => {
    const newHeight = heightMeters * WALL_SCALE
    const currentEdited = exhibitionArtworksById[currentArtworkId]
    if (!currentEdited) return

    const y = currentEdited.posY2d
    const currentHeight = currentEdited.height2d
    const newY = y + (currentHeight - newHeight) / 2

    const new3DCoordinate = convert2DTo3D(
      currentEdited.posX2d,
      newY,
      currentEdited.width2d,
      newHeight,
      boundingData,
    )

    dispatch(pushToHistory())
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { height2d: newHeight, posY2d: newY, ...new3DCoordinate },
      }),
    )
  }

  return {
    handleNameChange,
    handleAlignChange,
    handleFromLeftChange,
    handleFromRightChange,
    handleFromTopChange,
    handleFromBottomChange,
    handleWidthChange,
    handleHeightChange,
  }
}
