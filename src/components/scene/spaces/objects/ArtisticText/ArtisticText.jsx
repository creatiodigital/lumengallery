import { Text } from '@react-three/drei'
import React, { useState, useRef, useEffect } from 'react'
import { DoubleSide } from 'three'

const ArtisticText = ({ artwork }) => {
  const { id, position, quaternion, space, artisticText, artisticTextStyles } = artwork

  const textAlign = artisticTextStyles?.textAlign || 'left'
  const textColor = artisticTextStyles?.color.value || '#000000'
  const fontSize = artisticTextStyles?.fontSize.value || 16
  const lineHeight = artisticTextStyles?.lineHeight.value || 1
  const fontWeight = artisticTextStyles?.fontWeight.value || 'regular'
  const fontFamily = artisticTextStyles?.fontFamily.value || 'roboto'

  const fontSizeFactor = 0.01

  const fontMap = {
    roboto: {
      regular: '/fonts/roboto-regular.ttf',
      bold: '/fonts/roboto-bold.ttf',
    },
    lora: {
      regular: '/fonts/lora-regular.ttf',
      bold: '/fonts/lora-bold.ttf',
    },
  }

  const fontUrl = fontMap[fontFamily]?.[fontWeight] || fontMap['roboto']['regular']

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

  const planeWidth = space.width || 1
  const planeHeight = space.height || 1

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
    <group position={position} quaternion={quaternion}>
      {!artisticText && (
        <mesh renderOrder={1}>
          <planeGeometry args={[planeWidth, planeHeight]} />
          <meshBasicMaterial color="white" side={DoubleSide} />
        </mesh>
      )}

      {artisticText && (
        <mesh key={id} renderOrder={2}>
          <Text
            ref={textRef}
            fontSize={fontSize * fontSizeFactor}
            lineHeight={lineHeight}
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
      )}
    </group>
  )
}

export default ArtisticText
