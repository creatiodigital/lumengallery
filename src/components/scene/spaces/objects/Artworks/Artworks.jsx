import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Vector3, Quaternion } from 'three'

import { Artwork } from '@/components/scene/spaces/objects/Artwork'

const Artworks = () => {
  const allArtworkIds = useSelector((state) => state.artworks.allIds)
  const artworksbyId = useSelector((state) => state.artworks.byId)
  const exhibitionArtworksById = useSelector((state) => state.exhibition.exhibitionArtworksById)

  const artworksWithPosition = useMemo(() => {
    return allArtworkIds?.map((id) => {
      const artwork = artworksbyId[id]
      const pos = exhibitionArtworksById[id]
      if (!artwork || !artwork.space || !pos) return null

      const position = new Vector3(pos.posX3d, pos.posY3d, pos.posZ3d)

      const quaternion = new Quaternion(
        pos.quaternionX,
        pos.quaternionY,
        pos.quaternionZ,
        pos.quaternionW,
      )

      const width = pos.width3d || 1
      const height = pos.height3d || 1

      return {
        ...artwork,
        position,
        quaternion,
        width,
        height,
      }
    })
  }, [allArtworkIds, artworksbyId, exhibitionArtworksById])

  return (
    <>
      {artworksWithPosition.map((artwork) => (
        <Artwork key={artwork.id} artwork={artwork} />
      ))}
    </>
  )
}

export default Artworks
