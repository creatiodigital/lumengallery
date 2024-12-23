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
            fontSize={space.height / 10 || 0.5} // Dynamically scale font size based on height
            color="black" // Text color
            anchorX="center" // Center align horizontally
            anchorY="middle" // Center align vertically
            maxWidth={space.width || 1} // Constrain text width to plane width
            textAlign="center" // Align text centrally within the plane
            lineHeight={1.2} // Adjust line height for paragraph spacing
            whiteSpace="normal" // Break long words if needed
          >
            {artisticText}
          </Text>
        </>
      )}
    </mesh>
  )
}

export default Artwork
