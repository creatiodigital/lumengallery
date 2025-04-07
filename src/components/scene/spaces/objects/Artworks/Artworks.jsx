import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Vector3, Quaternion } from 'three'

import { Artwork } from '@/components/scene/spaces/objects/Artwork'

const Artworks = () => {
  const allIds = useSelector((state) => state.artworks.allIds)
  const byId = useSelector((state) => state.artworks.byId)

  const precomputedArtworks = useMemo(() => {
    return allIds?.map((id) => {
      const artwork = byId[id]
      if (!artwork.space) return null

      const position = new Vector3(
        artwork.space.position.x,
        artwork.space.position.y,
        artwork.space.position.z,
      )

      const quaternion = new Quaternion(
        artwork.space.quaternion.x,
        artwork.space.quaternion.y,
        artwork.space.quaternion.z,
        artwork.space.quaternion.w,
      )

      const width = artwork.space.width || 1
      const height = artwork.space.height || 1

      return {
        ...artwork,
        position,
        quaternion,
        space: {
          ...artwork.space,
          width,
          height,
        },
      }
    })
  }, [allIds, byId])

  return (
    <>
      {precomputedArtworks?.map(
        (artwork) => artwork && <Artwork key={artwork.id} artwork={artwork} />,
      )}
    </>
  )
}

export default Artworks
