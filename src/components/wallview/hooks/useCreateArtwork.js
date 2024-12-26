import { useDispatch, useSelector } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'

import { convert2DTo3D } from '@/components/wallview/utils'
import { createArtwork, edit3DCoordinates } from '@/lib/features/artistSlice'
import { chooseCurrentArtworkId } from '@/lib/features/wallViewSlice'
import { showWizard } from '@/lib/features/wizardSlice'

export const useCreateArtwork = (boundingData, scaleFactor, currentWallId) => {
  const dispatch = useDispatch()

  const wallWidth = useSelector((state) => state.wallView.wallWidth)
  const wallHeight = useSelector((state) => state.wallView.wallHeight)

  const handleCreateArtwork = (artworkType) => {
    if (!boundingData) return

    const x = (wallWidth * 100) / 2 - 50 / scaleFactor
    const y = (wallHeight * 100) / 2 - 50 / scaleFactor
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

    dispatch(
      edit3DCoordinates({
        currentArtworkId: artworkId,
        serialized3DCoordinate: new3DCoordinate,
      }),
    )
  }

  return { handleCreateArtwork }
}
