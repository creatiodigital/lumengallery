import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'

import SceneContext from '@/contexts/SceneContext'

import {
  createMouseState,
  handleMouseMove,
  handleTouchMove,
  handleKeyPress,
  attachMouseHandlers,
  attachTouchHandlers,
  detachMouseHandlers,
  detachTouchHandlers,
  calculateMovementVector,
  detectCollisions,
} from './helpers'

const MainCamera = () => {
  const [, setTick] = useState(0)
  const { wallRefs } = useContext(SceneContext)
  const keysPressed = useRef({})
  const mouseState = useRef(createMouseState())
  const initialPositionSet = useRef(false)
  const rotationVelocity = useRef(0)
  const dampingFactor = 0.6
  const collitionDistance = 1

  const moveSpeed = 0.04
  const cameraElevation = 1.4

  const onMouseMove = useCallback(handleMouseMove(mouseState, setTick), [])
  const onMouseDown = useCallback(attachMouseHandlers(onMouseMove, mouseState), [onMouseMove])
  const onMouseUp = useCallback(detachMouseHandlers(onMouseMove, mouseState), [onMouseMove])

  const onTouchMove = useCallback(handleTouchMove(mouseState, setTick), [])
  const onTouchStart = useCallback(attachTouchHandlers(onTouchMove, mouseState), [onTouchMove])
  const onTouchEnd = useCallback(detachTouchHandlers(onTouchMove, mouseState), [onTouchMove])

  const onKeyDown = useCallback((event) => handleKeyPress(keysPressed, event.key, true), [])
  const onKeyUp = useCallback((event) => handleKeyPress(keysPressed, event.key, false), [])

  const wallCoordinates = useSelector((state) => state.wallView.currentWallCoordinates)
  const wallNormal = useSelector((state) => state.wallView.currentWallNormal)

  console.log('xxx', wallNormal)

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [onKeyDown, onKeyUp, onMouseDown, onMouseUp, onTouchStart, onTouchEnd])

  useFrame(({ camera }) => {
    if (!initialPositionSet.current) {
      // Initialize camera position and orientation based on wallCoordinates and wallNormal
      if (wallCoordinates && wallNormal) {
        const lookAt = new Vector3(wallCoordinates.x, cameraElevation, wallCoordinates.z)
        const offsetDistance = 5
        const offset = new Vector3(wallNormal.x * offsetDistance, 0, wallNormal.z * offsetDistance)
        const cameraPosition = lookAt.clone().add(offset)

        camera.position.set(cameraPosition.x, cameraElevation, cameraPosition.z)
        camera.lookAt(lookAt)
        camera.updateProjectionMatrix()
      }

      initialPositionSet.current = true
    }

    if (Math.abs(mouseState.current.deltaX) > 0.5) {
      rotationVelocity.current += mouseState.current.deltaX * 0.002
    }

    rotationVelocity.current *= dampingFactor

    const rotationDelta = -rotationVelocity.current
    camera.rotateY(rotationDelta)

    const moveVector = calculateMovementVector(keysPressed, moveSpeed, camera)

    if (!detectCollisions(camera, moveVector, wallRefs, collitionDistance)) {
      camera.position.add(moveVector)
    }

    mouseState.current.deltaX = 0
  })

  return null
}

export default MainCamera
