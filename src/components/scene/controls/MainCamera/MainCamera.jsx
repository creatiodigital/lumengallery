import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { Vector3 } from 'three'

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
  const { wallRefs, windowRefs, glassRefs } = useContext(SceneContext)
  const keysPressed = useRef({})
  const mouseState = useRef(createMouseState())
  const initialPositionSet = useRef(false)
  const rotationVelocity = useRef(0)
  const dampingFactor = 0.6
  const collitionDistance = 1

  const moveSpeed = 0.04
  const cameraElevation = 1.2

  const onMouseMove = useCallback(
    (event) => handleMouseMove(mouseState, setTick)(event),
    [mouseState, setTick],
  )
  const onMouseDown = useCallback(
    (event) => attachMouseHandlers(onMouseMove, mouseState)(event),
    [onMouseMove, mouseState],
  )
  const onMouseUp = useCallback(
    (event) => detachMouseHandlers(onMouseMove, mouseState)(event),
    [onMouseMove, mouseState],
  )
  const onTouchMove = useCallback(
    (event) => handleTouchMove(mouseState, setTick)(event),
    [mouseState, setTick],
  )
  const onTouchStart = useCallback(
    (event) => attachTouchHandlers(onTouchMove, mouseState)(event),
    [onTouchMove, mouseState],
  )
  const onTouchEnd = useCallback(
    () => detachTouchHandlers(onTouchMove, mouseState)(),
    [onTouchMove, mouseState],
  )
  const onKeyDown = useCallback(
    (event) => handleKeyPress(keysPressed, event.key, true),
    [keysPressed],
  )
  const onKeyUp = useCallback(
    (event) => handleKeyPress(keysPressed, event.key, false),
    [keysPressed],
  )
  const wallCoordinates = useSelector((state) => state.wallView.currentWallCoordinates)
  const wallNormal = useSelector((state) => state.wallView.currentWallNormal)

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

    if (!detectCollisions(camera, moveVector, wallRefs, windowRefs, glassRefs, collitionDistance)) {
      camera.position.add(moveVector)
    }

    mouseState.current.deltaX = 0
  })

  return null
}

export default MainCamera
