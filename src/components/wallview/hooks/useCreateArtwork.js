import { useDispatch, useSelector } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'

import { convert2DTo3D } from '@/components/wallview/utils'
import { createArtwork, edit3DCoordinates, editArtworkType } from '@/lib/features/artistSlice'
import { chooseCurrentArtworkId } from '@/lib/features/wallViewSlice'
import { showWizard } from '@/lib/features/wizardSlice'

export const useCreateArtwork = (boundingData, scaleFactor, currentWallId) => {
  const dispatch = useDispatch()

  const wallWidth = useSelector((state) => state.wallView.wallWidth)
  const wallHeight = useSelector((state) => state.wallView.wallHeight)

  const handleCreateArtwork = (artworkType) => {
    if (!boundingData) return

    const x = (wallWidth * 100) / 2 - 20 / scaleFactor
    const y = (wallHeight * 100) / 2 - 20 / scaleFactor
    const artworkId = uuidv4()

    dispatch(showWizard())
    dispatch(chooseCurrentArtworkId(artworkId))

    dispatch(
      createArtwork({
        id: artworkId,
        wallId: currentWallId,
        canvas: {
          x,
          y,
          width: 40,
          height: 40,
        },
        imageURL: null,
      }),
    )

    dispatch(
      editArtworkType({
        currentArtworkId: artworkId,
        artworkType,
      }),
    )

    const new3DCoordinate = convert2DTo3D(
      {
        x,
        y,
        size: {
          w: 40,
          h: 40,
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
