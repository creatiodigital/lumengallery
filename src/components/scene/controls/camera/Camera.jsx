import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useRef, useState, useCallback } from 'react'

import SceneContext from '@/contexts/SceneContext'

import {
  createMouseState,
  handleMouseMove,
  handleKeyPress,
  attachMouseHandlers,
  detachMouseHandlers,
  calculateMovementVector,
  detectCollisions,
} from './helpers'

const Camera = () => {
  const [, setTick] = useState(0)
  const { wallRefs } = useContext(SceneContext)
  const keysPressed = useRef({})
  const mouseState = useRef(createMouseState())
  const initialPositionSet = useRef(false)
  const rotationVelocity = useRef(0)
  const dampingFactor = 0.6

  const moveSpeed = 0.04

  const onMouseMove = useCallback(handleMouseMove(mouseState, setTick), [])
  const onMouseDown = useCallback(attachMouseHandlers(onMouseMove, mouseState), [onMouseMove])
  const onMouseUp = useCallback(detachMouseHandlers(onMouseMove, mouseState), [onMouseMove])

  const onKeyDown = useCallback((event) => handleKeyPress(keysPressed, event.key, true), [])
  const onKeyUp = useCallback((event) => handleKeyPress(keysPressed, event.key, false), [])

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onKeyDown, onKeyUp, onMouseDown, onMouseUp])

  useFrame(({ camera }) => {
    if (!initialPositionSet.current) {
      camera.position.set(0, 1.4, 0)
      initialPositionSet.current = true
    }

    if (Math.abs(mouseState.current.deltaX) > 0.5) {
      rotationVelocity.current += mouseState.current.deltaX * 0.002
    }

    rotationVelocity.current *= dampingFactor
    camera.rotation.y -= rotationVelocity.current

    const moveVector = calculateMovementVector(keysPressed, moveSpeed, camera)

    if (!detectCollisions(camera, moveVector, wallRefs)) {
      camera.position.add(moveVector)
    }

    mouseState.current.deltaX = 0
  })

  return null
}

export default Camera
