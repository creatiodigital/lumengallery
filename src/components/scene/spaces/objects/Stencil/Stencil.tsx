import { Text } from '@react-three/drei'
import React, { useState, useRef, useEffect } from 'react'
import type { ComponentRef } from 'react'
import { DoubleSide, Vector3, Quaternion } from 'three'

import type { TArtwork } from '@/types/artwork'

type StencilProps = {
  artwork: TArtwork
}

const Stencil = ({ artwork }: StencilProps) => {
  const {
    id,
    position,
    quaternion,
    width,
    height,
    textContent,
    textAlign,
    textColor,
    fontSize,
    lineHeight,
    fontWeight,
    fontFamily,
  } = artwork
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

  const resolvedFontFamily = fontFamily?.value ?? 'roboto'
  const resolvedFontWeight = fontWeight?.value ?? 'regular'
  const fontUrl = fontMap[resolvedFontFamily][resolvedFontWeight]

  const textRef = useRef<ComponentRef<typeof Text>>(null)
  const [textWidth, setTextWidth] = useState(0)

  const positionVec3 = new Vector3(position.x, position.y, position.z)
  const quaternionObj = quaternion
    ? new Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
    : undefined

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
    <group position={positionVec3} quaternion={quaternionObj}>
      {!textContent && (
        <mesh renderOrder={1}>
          <planeGeometry args={[planeWidth, planeHeight]} />
          <meshBasicMaterial color="white" side={DoubleSide} />
        </mesh>
      )}

      {textContent && fontSize?.value && (
        <mesh key={id} renderOrder={2}>
          <Text
            ref={textRef}
            fontSize={fontSize?.value * fontSizeFactor}
            lineHeight={lineHeight?.value}
            color={textColor}
            font={fontUrl}
            anchorX={getAnchorX(textAlign, width ?? 1)}
            anchorY={getAnchorY(height ?? 1)}
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
