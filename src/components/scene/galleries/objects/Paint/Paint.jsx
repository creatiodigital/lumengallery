import { Image } from '@react-three/drei'
import React from 'react'
import { useDispatch } from 'react-redux'
import { DoubleSide } from 'three'

import { showArtworkPanel } from '@/lib/features/dashboardSlice'
import { setCurrentArtwork } from '@/lib/features/sceneSlice'

const Paint = ({ artwork }) => {
  const { id, position, quaternion, space, url } = artwork
  const dispatch = useDispatch()

  const handleClick = () => {
    dispatch(showArtworkPanel())
    dispatch(setCurrentArtwork(artwork.id))
  }

  return (
    <mesh
      key={id}
      position={position}
      quaternion={quaternion}
      renderOrder={2}
      onClick={handleClick}
    >
      <Image url={url} alt="paint" side={DoubleSide} transparent toneMapped={false}>
        <planeGeometry args={[space.width || 1, space.height || 1]} />
      </Image>
    </mesh>
  )
}

export default Paint
