import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { TextureLoader, Vector3, Quaternion, SRGBColorSpace } from 'three'

import { Artwork } from '../Artwork'

const Artworks = () => {
  const artworks = useSelector((state) => state.artist.artworks)

  const precomputedArtworks = useMemo(() => {
    return artworks?.map((artwork) => {
      if (!artwork.url || !artwork.space) return null

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

      const texture = (() => {
        if (!artwork.url) return null
        const loader = new TextureLoader()
        const loadedTexture = loader.load(artwork.url)
        loadedTexture.colorSpace = SRGBColorSpace
        return loadedTexture
      })()

      return { ...artwork, position, quaternion, texture }
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
