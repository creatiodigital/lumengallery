import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { addArtworkToGroup, removeGroup, createArtworkGroup } from '@/lib/features/wallViewSlice'

export const useGroupArtwork = () => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const artworks = useSelector((state) => state.artist.artworks)

  const handleAddArtworkToGroup = (artworkId) => {
    if (!artworkGroupIds.includes(artworkId)) {
      dispatch(addArtworkToGroup(artworkId))
    }
  }

  const handleRemoveArtworkGroup = () => {
    dispatch(removeGroup())
  }

  const handleGroupDragStart = (e) => {
    console.log('dragging', e)
  }

  const handleCreateArtworkGroup = () => {
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
  }

  useEffect(() => {
    handleCreateArtworkGroup()
  }, [artworkGroupIds])

  return {
    handleCreateArtworkGroup,
    handleAddArtworkToGroup,
    handleRemoveArtworkGroup,
    handleGroupDragStart,
  }
}
