import { Image } from '@react-three/drei'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DoubleSide, MeshStandardMaterial } from 'three'

import { Frame } from '@/components/scene/galleries/objects/Frame'
import { Passepartout } from '@/components/scene/galleries/objects/Passepartout'
import { showArtworkPanel } from '@/lib/features/dashboardSlice'
import { setCurrentArtwork } from '@/lib/features/sceneSlice'

const ArtisticImage = ({ artwork }) => {
  const {
    position,
    quaternion,
    space,
    url,
    showFrame,
    showPassepartout,
    showArtworkInformation,
    frameStyles,
    passepartoutStyles,
  } = artwork
  const { frameColor, frameThickness } = frameStyles
  const { passepartoutColor, passepartoutThickness } = passepartoutStyles

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

  const passepartoutMaterial = new MeshStandardMaterial({
    color: passepartoutColor,
    roughness: 1,
  })

  const frameT = showFrame ? frameThickness : 0
  const passepartoutT = showPassepartout ? passepartoutThickness : 0

  const innerWidth = planeWidth - (frameT + passepartoutT) / 50
  const innerHeight = planeHeight - (frameT + passepartoutT) / 50

  return (
    <group position={position} quaternion={quaternion} onDoubleClick={handleClick}>
      <mesh renderOrder={1}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {!url && (
        <mesh renderOrder={2}>
          <planeGeometry args={[innerWidth, innerHeight]} />
          <meshBasicMaterial color="white" side={DoubleSide} />
        </mesh>
      )}

      {url && (
        <mesh castShadow receiveShadow renderOrder={2}>
          <Image url={url} alt="paint" side={DoubleSide} transparent toneMapped={false}>
            <planeGeometry args={[innerWidth, innerHeight]} />
          </Image>
        </mesh>
      )}

      {showFrame && (
        <Frame
          width={planeWidth}
          height={planeHeight}
          thickness={frameThickness / 100}
          material={frameMaterial}
        />
      )}
      {showPassepartout && passepartoutThickness > 0 && (
        <Passepartout
          width={planeWidth - frameThickness / 50}
          height={planeHeight - frameThickness / 50}
          thickness={passepartoutThickness / 100}
          material={passepartoutMaterial}
        />
      )}
    </group>
  )
}

export default ArtisticImage
