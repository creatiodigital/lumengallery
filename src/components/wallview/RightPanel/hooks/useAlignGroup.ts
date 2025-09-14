import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'
import type { TAlign } from '@/types/wizard'

export const useAlignGroup = (boundingData: TDimensions | null) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state: RootState) => state.wallView.artworkGroup)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  const alignArtworksInGroup = (alignment: TAlign) => {
    const { groupX, groupY, groupWidth, groupHeight } = artworkGroup

    artworkGroupIds.forEach((artworkId) => {
      const artwork = exhibitionArtworksById[artworkId]

      if (artwork) {
        const posX2d = artwork.posX2d
        const posY2d = artwork.posY2d
        const width2d = artwork.width2d
        const height2d = artwork.height2d

        let newX = posX2d
        let newY = posY2d

        switch (alignment) {
          case 'verticalTop':
            newY = groupY
            break
          case 'verticalCenter':
            newY = groupY + groupHeight / 2 - height2d / 2
            break
          case 'verticalBottom':
            newY = groupY + groupHeight - height2d
            break
          case 'horizontalLeft':
            newX = groupX
            break
          case 'horizontalCenter':
            newX = groupX + groupWidth / 2 - width2d / 2
            break
          case 'horizontalRight':
            newX = groupX + groupWidth - width2d
            break
          default:
            break
        }

        const artworkPosition = {
          posX2d: newX,
          posY2d: newY,
          width2d,
          height2d,
        }

        if (boundingData) {
          const new3DCoordinate = convert2DTo3D(newX, newY, width2d, height2d, boundingData)
          dispatch(
            updateArtworkPosition({
              artworkId,
              artworkPosition: { ...artworkPosition, ...new3DCoordinate },
            }),
          )
        }
      }
    })
  }

  return {
    alignArtworksInGroup,
  }
}
