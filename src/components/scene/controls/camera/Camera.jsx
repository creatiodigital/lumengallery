import { useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import SceneContext from '@/contexts/SceneContext'
import * as THREE from 'three'

const Camera = () => {
  const [, setTick] = useState(0)
  const { wallRefs } = useContext(SceneContext)
  const keysPressed = useRef({})
  const mouseState = useRef({
    isLeftButtonPressed: false,
    lastMouseX: null,
    deltaX: 0,
  })

  const initialPositionSet = useRef(false)

  const handleMouseMove = useCallback((event) => {
    if (!mouseState.current.isLeftButtonPressed) return

    const currentX = event.clientX
    const deltaX = currentX - mouseState.current.lastMouseX
    mouseState.current.deltaX = deltaX
    mouseState.current.lastMouseX = currentX
    setTick((tick) => tick + 1)
  }, [])

  const handleKeyDown = useCallback(
    (event) => (keysPressed.current[event.key.toLowerCase()] = true),
    [],
  )
  const handleKeyUp = useCallback(
    (event) => (keysPressed.current[event.key.toLowerCase()] = false),
    [],
  )

  const handleMouseDown = useCallback(
    (event) => {
      if (event.button === 0) {
        mouseState.current = {
          ...mouseState.current,
          isLeftButtonPressed: true,
          lastMouseX: event.clientX,
          deltaX: 0,
        }
        window.addEventListener('mousemove', handleMouseMove)
      }
    },
    [handleMouseMove],
  )

  const handleMouseUp = useCallback(
    (event) => {
      if (event.button === 0) {
        mouseState.current = {
          ...mouseState.current,
          isLeftButtonPressed: false,
          deltaX: 0,
        }
        window.removeEventListener('mousemove', handleMouseMove)
      }
    },
    [handleMouseMove],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [
    handleKeyDown,
    handleKeyUp,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
  ])

  const rotationVelocity = useRef(0)
  const dampingFactor = 0.6

  useFrame(({ camera }) => {
    const sensorSize = 35
    const focalLength = 30
    const fov = 2 * Math.atan(sensorSize / (2 * focalLength)) * (180 / Math.PI)

    camera.fov = fov
    camera.updateProjectionMatrix()

    if (!initialPositionSet.current) {
      camera.position.set(0, 1.6, 0)
      initialPositionSet.current = true
    }

    // Update the rotation velocity based on mouse movement
    if (Math.abs(mouseState.current.deltaX) > 0.5) {
      rotationVelocity.current += mouseState.current.deltaX * 0.002
    }

    // Apply damping to smooth out the rotation
    rotationVelocity.current *= dampingFactor

    // Apply the rotation velocity to the camera's rotation
    camera.rotation.y -= rotationVelocity.current

    const moveSpeed = 0.1
    let moveVector = new THREE.Vector3()
    let direction = new THREE.Vector3()

    if (keysPressed.current['arrowup'] || keysPressed.current['w'])
      moveVector.z -= 1
    if (keysPressed.current['arrowdown'] || keysPressed.current['s'])
      moveVector.z += 1
    if (keysPressed.current['arrowleft'] || keysPressed.current['a'])
      moveVector.x -= 1
    if (keysPressed.current['arrowright'] || keysPressed.current['d'])
      moveVector.x += 1

    if (moveVector.lengthSq() > 0) {
      moveVector
        .normalize()
        .applyQuaternion(camera.quaternion)
        .multiplyScalar(moveSpeed)
      direction.copy(moveVector).normalize()

      const raycaster = new THREE.Raycaster(camera.position, direction, 0, 3)

      let collisionDetected = false

      wallRefs.current.forEach((ref) => {
        if (ref.current) {
          const intersections = raycaster.intersectObject(ref.current, true)
          if (intersections.length > 0 && intersections[0].distance <= 2) {
            collisionDetected = true
          }
        }
      })

      if (!collisionDetected) {
        camera.position.add(moveVector)
      }
    }

    mouseState.current.deltaX = 0
  })

  return <></>
}

export default Camera
