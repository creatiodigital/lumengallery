import React from 'react'
import { useDispatch } from 'react-redux'
import { DoubleSide } from 'three'
import { Text } from '@react-three/drei' // Import Text component
import { setCurrentArtwork } from '@/lib/features/sceneSlice'
import { showArtworkPanel } from '@/lib/features/dashboardSlice'

const Artwork = ({ artwork }) => {
  const { id, position, quaternion, space, texture, artworkType, artisticText } = artwork
  const dispatch = useDispatch()

  const handleClick = () => {
    if (artworkType !== 'text') {
      dispatch(showArtworkPanel())
      dispatch(setCurrentArtwork(artwork.id))
    }
  }

  return (
    <mesh
      key={id}
      position={position}
      quaternion={quaternion}
      renderOrder={2}
      onClick={artworkType === 'paint' ? handleClick : undefined}
    >
      {artworkType === 'paint' && (
        <>
          <planeGeometry args={[space.width || 1, space.height || 1]} />
          <meshBasicMaterial
            side={DoubleSide}
            toneMapped={false}
            map={texture || null}
            roughness={1}
            metalness={0}
          />
        </>
      )}

      {artworkType === 'text' && (
        <>
          {/* <planeGeometry args={[space.width || 1, space.height || 1]} /> */}
          <Text
            fontSize={0.14}
            lineHeight={1.7}
            color="black"
            anchorX="center"
            anchorY="middle"
            maxWidth={space.width}
            textAlign="left"
            whiteSpace="normal"
          >
            {artisticText}
          </Text>
        </>
      )}
    </mesh>
  )
}

export default Artwork
