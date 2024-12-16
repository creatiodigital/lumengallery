import { useDispatch } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'

import { createArtwork, edit3DCoordinates } from '@/lib/features/artistSlice'
import { chooseCurrentArtworkId } from '@/lib/features/wallViewSlice'
import { showWizard } from '@/lib/features/wizardSlice'

import { convert2DTo3D } from './utils'

export const useCreateArtwork = (boundingData, scaleFactor, currentWallId) => {
  const dispatch = useDispatch()

  const handleCreateArtwork = (event, wallRef) => {
    if (!boundingData || !wallRef.current) return

    const rect = wallRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left - 20) / scaleFactor
    const y = (event.clientY - rect.top - 20) / scaleFactor
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

  return {
    handleCreateArtwork,
  }
}
