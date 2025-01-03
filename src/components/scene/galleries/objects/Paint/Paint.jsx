import { Image } from '@react-three/drei'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DoubleSide, MeshStandardMaterial } from 'three'

import { Frame } from '@/components/scene/galleries/objects/Frame'
import { showArtworkPanel } from '@/lib/features/dashboardSlice'
import { setCurrentArtwork } from '@/lib/features/sceneSlice'

const Paint = ({ artwork }) => {
  const { position, quaternion, space, url, showFrame, showArtworkInformation, frameStyles } =
    artwork
  const { frameColor, frameThickness } = frameStyles

  const isPlaceholdersShown = useSelector((state) => state.scene.isPlaceholdersShown)
  const dispatch = useDispatch()

  const handleClick = () => {
    if (!isPlaceholdersShown && showArtworkInformation) {
      dispatch(showArtworkPanel())
      dispatch(setCurrentArtwork(artwork.id))
    }
  }

  const planeWidth = space.width || 1
  const planeHeight = space.height || 1

  const frameMaterial = new MeshStandardMaterial({
    color: frameColor,
    roughness: 0.3,
    metalness: 0.1,
  })

  return (
    <group position={position} quaternion={quaternion} onDoubleClick={handleClick}>
      <mesh renderOrder={2}>
        <Image url={url} alt="paint" side={DoubleSide} transparent toneMapped={false}>
          <planeGeometry args={[planeWidth, planeHeight]} />
        </Image>
      </mesh>
      {showFrame && (
        <Frame
          width={planeWidth}
          height={planeHeight}
          thickness={frameThickness / 100}
          material={frameMaterial}
        />
      )}
    </group>
  )
}

export default Paint
