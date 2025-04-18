import { Text } from '@react-three/drei'
import React, { useState, useRef, useEffect } from 'react'
import { DoubleSide } from 'three'

const ArtisticText = ({ artwork }) => {
  const { id, position, quaternion, width, height, artisticTextProperties } = artwork
  const textContent = artisticTextProperties?.textContent || ''
  const textAlign = artisticTextProperties?.textAlign || 'left'
  const textColor = artisticTextProperties?.textColor.value || '#000000'
  const fontSize = artisticTextProperties?.fontSize.value || 16
  const lineHeight = artisticTextProperties?.lineHeight.value || 1
  const fontWeight = artisticTextProperties?.fontWeight.value || 'regular'
  const fontFamily = artisticTextProperties?.fontFamily.value || 'roboto'

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
  }, [textContent])

  const planeWidth = width || 1
  const planeHeight = height || 1

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
      {!textContent && (
        <mesh renderOrder={1}>
          <planeGeometry args={[planeWidth, planeHeight]} />
          <meshBasicMaterial color="white" side={DoubleSide} />
        </mesh>
      )}

      {textContent && (
        <mesh key={id} renderOrder={2}>
          <Text
            ref={textRef}
            fontSize={fontSize * fontSizeFactor}
            lineHeight={lineHeight}
            color={textColor}
            font={fontUrl}
            anchorX={getAnchorX(textAlign, width)}
            anchorY={getAnchorY(height)}
            maxWidth={width}
            textAlign={textAlign}
            whiteSpace="normal"
            overflowWrap="break-word"
            onSync={calculateTextWidth}
          >
            {textContent}
          </Text>
        </mesh>
      )}
    </group>
  )
}

export default ArtisticText
