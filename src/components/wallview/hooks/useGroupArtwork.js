import { useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { addArtworkToGroup, removeGroup, createArtworkGroup } from '@/lib/features/wallViewSlice'

export const useGroupArtwork = () => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const artworks = useSelector((state) => state.artworks.artworks)

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

    const artworkGroupItems = artworks.filter((artwork) => artworkGroupIds.includes(artwork.id))
    const xValues = artworkGroupItems.map((artwork) => artwork.canvas.x)
    const xEdgeValues = artworkGroupItems.map((artwork) => artwork.canvas.x + artwork.canvas.width)
    const yValues = artworkGroupItems.map((artwork) => artwork.canvas.y)
    const yEdgeValues = artworkGroupItems.map((artwork) => artwork.canvas.y + artwork.canvas.height)

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
  }, [artworkGroupIds, artworks, dispatch])

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
