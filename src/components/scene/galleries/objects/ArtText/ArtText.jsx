import { Text } from '@react-three/drei'
import React, { useState, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'

const ArtText = ({ artwork }) => {
  const { id, position, quaternion, space, artisticText } = artwork

  const editArtworkTextAlign = useSelector((state) => {
    const currentArtwork = state.artist.artworks.find((a) => a.id === artwork.id)
    return currentArtwork?.artisticTextStyles?.textAlign || 'left'
  })

  const textRef = useRef()
  const [textWidth, setTextWidth] = useState(0)

  const calculateTextWidth = () => {
    if (textRef.current) {
      const geometry = textRef.current.geometry
      geometry.computeBoundingBox()
      const boundingBox = geometry.boundingBox
      if (boundingBox) {
        const width = boundingBox.max.x - boundingBox.min.x
        setTextWidth(width > 0 ? width : 0)
      }
    }
  }

  useEffect(() => {
    if (textRef.current) {
      textRef.current.sync()
      calculateTextWidth()
    }
  }, [artisticText])

  const getAnchorX = (textAlign, planeWidth) => {
    switch (textAlign) {
      case 'left':
        return -planeWidth / 2 + planeWidth
      case 'right':
        return planeWidth / 2 - planeWidth + textWidth
      case 'center':
        return textWidth / 2
      default:
        return 0
    }
  }

  const getAnchorY = (planeHeight) => {
    return planeHeight / 2 - planeHeight
  }

  return (
    <mesh key={id} position={position} quaternion={quaternion} renderOrder={2}>
      <Text
        ref={textRef}
        fontSize={0.14}
        lineHeight={1.7}
        color="black"
        anchorX={getAnchorX(editArtworkTextAlign, space.width)}
        anchorY={getAnchorY(space.height)}
        maxWidth={space.width}
        textAlign={editArtworkTextAlign}
        whiteSpace="normal"
        overflowWrap="break-word"
        onSync={calculateTextWidth}
      >
        {artisticText}
      </Text>
    </mesh>
  )
}

export default ArtText
