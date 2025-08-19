import { Image } from '@react-three/drei'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DoubleSide, MeshStandardMaterial } from 'three'

import { Frame } from '@/components/scene/spaces/objects/Frame'
import { Passepartout } from '@/components/scene/spaces/objects/Passepartout'
import { showArtworkPanel } from '@/app/redux/slices/dashboardSlice'
import { setCurrentArtwork } from '@/app/redux/slices/sceneSlice'

const ArtisticImage = ({ artwork }) => {
  const { position, quaternion, width, height, artisticImageProperties } = artwork

  const {
    showArtworkInformation,
    imageUrl,
    showFrame,
    frameColor,
    frameThickness,
    showPassepartout,
    passepartoutColor,
    passepartoutThickness,
  } = artisticImageProperties

  const isPlaceholdersShown = useSelector((state) => state.scene.isPlaceholdersShown)
  const dispatch = useDispatch()

  const handleClick = () => {
    if (!isPlaceholdersShown && showArtworkInformation) {
      dispatch(showArtworkPanel())
      dispatch(setCurrentArtwork(artwork.id))
    }
  }

  const planeWidth = width || 1
  const planeHeight = height || 1

  const frameMaterial = new MeshStandardMaterial({
    color: frameColor,
    roughness: 0.3,
    metalness: 0.1,
  })

  const passepartoutMaterial = new MeshStandardMaterial({
    color: passepartoutColor,
    roughness: 1,
  })

  const frameT = showFrame ? frameThickness.value : 0
  const passepartoutT = showPassepartout ? passepartoutThickness.value : 0

  const innerWidth = planeWidth - (frameT + passepartoutT) / 50
  const innerHeight = planeHeight - (frameT + passepartoutT) / 50

  return (
    <group position={position} quaternion={quaternion} onDoubleClick={handleClick}>
      <mesh renderOrder={1}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {!imageUrl && (
        <mesh renderOrder={2}>
          <planeGeometry args={[innerWidth, innerHeight]} />
          <meshBasicMaterial color="white" side={DoubleSide} />
        </mesh>
      )}

      {imageUrl && (
        <mesh castShadow receiveShadow renderOrder={2}>
          <Image url={imageUrl} alt="paint" side={DoubleSide} transparent toneMapped={false}>
            <planeGeometry args={[innerWidth, innerHeight]} />
          </Image>
        </mesh>
      )}

      {showFrame && (
        <Frame
          width={planeWidth}
          height={planeHeight}
          thickness={frameThickness.value / 100}
          material={frameMaterial}
        />
      )}
      {showPassepartout && passepartoutThickness.value > 0 && (
        <Passepartout
          width={planeWidth - frameThickness.value / 50}
          height={planeHeight - frameThickness.value / 50}
          thickness={passepartoutThickness.value / 100}
          material={passepartoutMaterial}
        />
      )}
    </group>
  )
}

export default ArtisticImage
