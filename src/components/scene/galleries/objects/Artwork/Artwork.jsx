import React from 'react'
import { useDispatch } from 'react-redux'
import { DoubleSide } from 'three'

import { showArtworkPanel, setCurrentArtwork } from '@/lib/features/sceneSlice'

const Artwork = ({ artwork }) => {
  const { id, position, quaternion, space, texture } = artwork
  const dispatch = useDispatch()

  return (
    <mesh
      key={id}
      position={position}
      quaternion={quaternion}
      renderOrder={2}
      onClick={() => {
        dispatch(showArtworkPanel())
        dispatch(setCurrentArtwork(artwork.id))
      }}
    >
      <planeGeometry args={[space.width || 1, space.height || 1]} />
      <meshBasicMaterial
        side={DoubleSide}
        toneMapped={false}
        map={texture || null}
        roughness={1}
        metalness={0}
      />
    </mesh>
  )
}

export default Artwork
