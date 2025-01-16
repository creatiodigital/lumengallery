import { Text } from '@react-three/drei'
import React, { useState, useRef, useEffect } from 'react'

const ArtisticText = ({ artwork }) => {
  const { id, position, quaternion, space, artisticText, artisticTextStyles } = artwork

  const textAlign = artisticTextStyles?.textAlign || 'left'
  const textColor = artisticTextStyles?.color || '#000000'
  const fontSize = Number(artisticTextStyles?.fontSize) || 16
  const lineHeight = Number(artisticTextStyles?.lineHeight) || 1
  const fontWeight = artisticTextStyles?.fontWeight || 'Regular'
  const fontFamily = artisticTextStyles?.fontFamily || 'Roboto'

  const fontSizeFactor = 0.01

  const fontMap = {
    Roboto: {
      Regular: '/fonts/roboto.ttf',
      Bold: '/fonts/roboto-bold.ttf',
    },
    Lora: {
      Regular: '/fonts/lora.ttf',
      Bold: '/fonts/lora-bold.ttf',
    },
  }

  const fontUrl = fontMap[fontFamily]?.[fontWeight] || fontMap['Roboto']['Regular']

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
        fontSize={fontSize * fontSizeFactor}
        lineHeight={lineHeight}
        // letterSpacing={letterSpacing * letterSpacingFactor}
        color={textColor}
        font={fontUrl}
        anchorX={getAnchorX(textAlign, space.width)}
        anchorY={getAnchorY(space.height)}
        maxWidth={space.width}
        textAlign={textAlign}
        whiteSpace="normal"
        overflowWrap="break-word"
        onSync={calculateTextWidth}
      >
        {artisticText}
      </Text>
    </mesh>
  )
}

export default ArtisticText
