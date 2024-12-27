import { Image } from '@react-three/drei'
import React from 'react'
import { useDispatch } from 'react-redux'
import { DoubleSide, MeshStandardMaterial } from 'three'

import { Frame } from '@/components/scene/galleries/objects/Frame'
import { showArtworkPanel } from '@/lib/features/dashboardSlice'
import { setCurrentArtwork } from '@/lib/features/sceneSlice'

const Paint = ({ artwork }) => {
  const { position, quaternion, space, url, showFrame } = artwork
  const dispatch = useDispatch()

  const handleClick = () => {
    dispatch(showArtworkPanel())
    dispatch(setCurrentArtwork(artwork.id))
  }

  const planeWidth = space.width || 1
  const planeHeight = space.height || 1

  const frameThickness = 0.02

  const frameMaterial = new MeshStandardMaterial({
    color: '#000000',
    roughness: 0.1,
    metalness: 0.6,
  })

  return (
    <group position={position} quaternion={quaternion} onClick={handleClick}>
      <mesh renderOrder={2}>
        <Image url={url} alt="paint" side={DoubleSide} transparent toneMapped={false}>
          <planeGeometry args={[planeWidth, planeHeight]} />
        </Image>
      </mesh>
      {showFrame && (
        <Frame
          width={planeWidth}
          height={planeHeight}
          thickness={frameThickness}
          material={frameMaterial}
        />
      )}
    </group>
  )
}

export default Paint
