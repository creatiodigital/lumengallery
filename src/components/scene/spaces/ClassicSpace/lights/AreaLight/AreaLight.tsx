import { useThree } from '@react-three/fiber'
import React from 'react'
import { useRef, useEffect } from 'react'
import { RectAreaLight } from 'three'
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper'

const AreaLight: React.FC = () => {
  const rectAreaLightRef = useRef<RectAreaLight | null>(null)
  const helperRef = useRef<RectAreaLightHelper | null>(null)
  const { scene } = useThree()

  useEffect(() => {
    const light = rectAreaLightRef.current
    if (!light) return

    light.rotation.y = Math.PI

    const helper = new RectAreaLightHelper(light)
    helperRef.current = helper

    const parent = light.parent ?? scene
    parent.add(helper)

    return () => {
      parent.remove(helper)
      helper.dispose()
    }
  }, [scene])

  return (
    <rectAreaLight
      ref={rectAreaLightRef}
      width={3}
      height={10}
      intensity={4}
      color="#ffffff"
      position={[-5.5, 6, -6.5]}
    />
  )
}

export default AreaLight
