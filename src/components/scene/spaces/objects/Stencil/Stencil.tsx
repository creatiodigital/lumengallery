import { Text } from '@react-three/drei'
import React, { useState, useRef, useEffect } from 'react'
import type { ComponentRef } from 'react'
import { DoubleSide, Vector3, Quaternion } from 'three'

import type { ArtisticTextType } from '@/types/artwork'

type StencilProps = {
  artwork: ArtisticTextType & {
    position: Vector3
    quaternion: Quaternion
    width: number
    height: number
  }
}

const Stencil = ({ artwork }: StencilProps) => {
  const { id, position, quaternion, width, height, artisticTextProperties } = artwork
  const { textContent, textAlign, textColor, fontSize, lineHeight, fontWeight, fontFamily } =
    artisticTextProperties

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
  } as const

  const fontUrl = fontMap[fontFamily.value]?.[fontWeight.value] ?? fontMap['roboto']['regular']

  const textRef = useRef<ComponentRef<typeof Text>>(null)
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

  const getAnchorX = (align: typeof textAlign, planeW: number): number => {
    switch (align) {
      case 'left':
        return -planeW / 2 + planeW
      case 'right':
        return planeW / 2 - planeW + textWidth
      case 'center':
        return textWidth / 2
      default:
        return 0
    }
  }

  const getAnchorY = (planeH: number): number => {
    return planeH / 2 - planeH
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
            fontSize={fontSize.value * fontSizeFactor}
            lineHeight={lineHeight.value}
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

export default Stencil
