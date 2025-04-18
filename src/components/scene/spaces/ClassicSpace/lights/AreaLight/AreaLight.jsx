import { useRef, useEffect } from 'react'
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper'

const AreaLight = () => {
  const rectAreaLightRef = useRef()
  const helperRef = useRef()

  useEffect(() => {
    if (rectAreaLightRef.current) {
      rectAreaLightRef.current.rotation.y = Math.PI

      const helper = new RectAreaLightHelper(rectAreaLightRef.current)
      helperRef.current = helper

      if (rectAreaLightRef.current.parent) {
        rectAreaLightRef.current.parent.add(helper)
      }
    }
  }, [])

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
