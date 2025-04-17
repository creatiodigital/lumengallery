import { useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { addArtworkToGroup, removeGroup, createArtworkGroup } from '@/lib/features/wallViewSlice'

export const useGroupArtwork = () => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds) // RETHINK THIS (PERHAPS ADD GROUP IN EXHIBITION SLICE)
  const positionsById = useSelector((state) => state.exhibition.positionsById)

  const handleAddArtworkToGroup = useCallback(
    (artworkId) => {
      if (!artworkGroupIds.includes(artworkId)) {
        dispatch(addArtworkToGroup(artworkId))
      }
    },
    [artworkGroupIds, dispatch],
  )

  const handleCreateArtworkGroup = useCallback(() => {
    if (artworkGroupIds.length === 0) return
    const artworkGroupItems = artworkGroupIds.map((id) => positionsById[id]) // RETHINK THIS (PERHAPS ADD GROUP IN EXHIBITION SLICE)
    const xValues = artworkGroupItems.map((artwork) => artwork.posX2d)
    const xEdgeValues = artworkGroupItems.map((artwork) => artwork.posX2d + artwork.width2d)
    const yValues = artworkGroupItems.map((artwork) => artwork.posY2d)
    const yEdgeValues = artworkGroupItems.map((artwork) => artwork.posY2d + artwork.height2d)

    const groupX = Math.min(...xValues)
    const maxGroupX = Math.max(...xEdgeValues)
    const groupY = Math.min(...yValues)
    const maxGroupY = Math.max(...yEdgeValues)
    const groupWidth = maxGroupX - groupX
    const groupHeight = maxGroupY - groupY

    const groupProps = {
      groupX,
      groupY,
      groupWidth,
      groupHeight,
    }

    dispatch(createArtworkGroup(groupProps))
  }, [artworkGroupIds, dispatch])

  const handleRemoveArtworkGroup = useCallback(() => {
    dispatch(removeGroup())
  }, [dispatch])

  useEffect(() => {
    if (artworkGroupIds.length > 0) {
      handleCreateArtworkGroup()
    }
  }, [artworkGroupIds])

  return {
    handleAddArtworkToGroup,
    handleRemoveArtworkGroup,
  }
}
