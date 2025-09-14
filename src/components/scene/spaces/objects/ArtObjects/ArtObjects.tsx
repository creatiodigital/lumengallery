import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Vector3, Quaternion } from 'three'

import { ArtObject } from '@/components/scene/spaces/objects/ArtObject'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

type ArtworkWithPosition = TArtwork & {
  position: Vector3
  quaternion: Quaternion
  width: number
  height: number
}

const ArtObjects = () => {
  const allArtworkIds = useSelector((state: RootState) => state.artworks.allIds)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  const artworksWithPosition: ArtworkWithPosition[] = useMemo(() => {
    return allArtworkIds
      .map((id) => {
        const artwork = artworksById[id]
        const pos = exhibitionArtworksById[id]
        if (!artwork || !pos) return null

        const position = new Vector3(pos.posX3d, pos.posY3d, pos.posZ3d)
        const quaternion = new Quaternion(
          pos.quaternionX,
          pos.quaternionY,
          pos.quaternionZ,
          pos.quaternionW,
        )

        return {
          ...artwork,
          position,
          quaternion,
          width: pos.width3d || 1,
          height: pos.height3d || 1,
        }
      })
      .filter((a): a is ArtworkWithPosition => a !== null) // remove nulls safely
  }, [allArtworkIds, artworksById, exhibitionArtworksById])

  return (
    <>
      {artworksWithPosition.map((artwork) => (
        <ArtObject key={artwork.id} artwork={artwork} />
      ))}
    </>
  )
}

export default ArtObjects
