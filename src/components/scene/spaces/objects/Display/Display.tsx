import { Image } from '@react-three/drei'
import { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DoubleSide, MeshStandardMaterial, Vector3, Quaternion } from 'three'

import { Frame } from '@/components/scene/spaces/objects/Frame'
import { Passepartout } from '@/components/scene/spaces/objects/Passepartout'
import { showArtworkPanel } from '@/redux/slices/dashboardSlice'
import { setCurrentArtwork } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { ArtisticImageType } from '@/types/artwork'

type DisplayProps = {
  artwork: ArtisticImageType
}

const Display = ({ artwork }: DisplayProps) => {
  const { position, quaternion, width, height, artisticImageProperties } = artwork

  const pos = useMemo(
    () => new Vector3(position.x, position.y, position.z),
    [position.x, position.y, position.z],
  )

  const quat = useMemo(
    () =>
      quaternion
        ? new Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
        : undefined,
    [quaternion?.x, quaternion?.y, quaternion?.z, quaternion?.w],
  )

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

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
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
    <group position={pos} quaternion={quat} onDoubleClick={handleClick}>
      {/* Invisible click area */}
      <mesh renderOrder={1}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Placeholder if no image */}
      {!imageUrl && (
        <mesh renderOrder={2}>
          <planeGeometry args={[innerWidth, innerHeight]} />
          <meshBasicMaterial color="white" side={DoubleSide} />
        </mesh>
      )}

      {/* Actual image */}
      {imageUrl && (
        <mesh castShadow receiveShadow renderOrder={2}>
          <Image url={imageUrl} side={DoubleSide} transparent toneMapped={false}>
            <planeGeometry args={[innerWidth, innerHeight]} />
          </Image>
        </mesh>
      )}

      {/* Frame */}
      {showFrame && (
        <Frame
          width={planeWidth}
          height={planeHeight}
          thickness={frameThickness.value / 100}
          material={frameMaterial}
        />
      )}

      {/* Passepartout */}
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

export default Display
