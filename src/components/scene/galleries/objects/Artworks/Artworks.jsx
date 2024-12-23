import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { TextureLoader, Vector3, Quaternion, SRGBColorSpace } from 'three'

import { Artwork } from '../Artwork'

const Artworks = () => {
  const artworks = useSelector((state) => state.artist.artworks)

  const precomputedArtworks = useMemo(() => {
    return artworks?.map((artwork) => {
      if (!artwork.space) return null // Ensure `space` is available

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

      // Load texture only if URL exists
      const texture = artwork.url
        ? (() => {
            const loader = new TextureLoader()
            const loadedTexture = loader.load(artwork.url)
            loadedTexture.colorSpace = SRGBColorSpace
            return loadedTexture
          })()
        : null

      // Default width and height if not provided
      const width = artwork.space.width || 1
      const height = artwork.space.height || 1

      return {
        ...artwork,
        position,
        quaternion,
        texture,
        space: {
          ...artwork.space,
          width,
          height,
        },
      }
    })
  }, [artworks])

  return (
    <>
      {precomputedArtworks?.map(
        (artwork) => artwork && <Artwork key={artwork.id} artwork={artwork} />,
      )}
    </>
  )
}

export default Artworks
