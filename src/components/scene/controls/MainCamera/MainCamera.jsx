import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useRef, useState, useCallback } from 'react'

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

  const onMouseMove = useCallback(handleMouseMove(mouseState, setTick), [])
  const onMouseDown = useCallback(attachMouseHandlers(onMouseMove, mouseState), [onMouseMove])
  const onMouseUp = useCallback(detachMouseHandlers(onMouseMove, mouseState), [onMouseMove])

  const onTouchMove = useCallback(handleTouchMove(mouseState, setTick), [])
  const onTouchStart = useCallback(attachTouchHandlers(onTouchMove, mouseState), [onTouchMove])
  const onTouchEnd = useCallback(detachTouchHandlers(onTouchMove, mouseState), [onTouchMove])

  const onKeyDown = useCallback((event) => handleKeyPress(keysPressed, event.key, true), [])
  const onKeyUp = useCallback((event) => handleKeyPress(keysPressed, event.key, false), [])

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
      camera.position.set(0, 1.4, 0)
      camera.fov = 70
      camera.updateProjectionMatrix()
      initialPositionSet.current = true
    }

    if (Math.abs(mouseState.current.deltaX) > 0.5) {
      rotationVelocity.current += mouseState.current.deltaX * 0.002
    }

    rotationVelocity.current *= dampingFactor
    camera.rotation.y -= rotationVelocity.current

    const moveVector = calculateMovementVector(keysPressed, moveSpeed, camera)

    if (!detectCollisions(camera, moveVector, wallRefs, collitionDistance)) {
      camera.position.add(moveVector)
    }

    mouseState.current.deltaX = 0
  })

  return null
}

export default MainCamera
