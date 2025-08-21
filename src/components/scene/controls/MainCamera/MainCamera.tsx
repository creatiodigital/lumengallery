'use client'

import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useRef, useState, useCallback, type RefObject } from 'react'
import { useSelector } from 'react-redux'
import { Vector3, PerspectiveCamera } from 'three'

import SceneContext from '@/contexts/SceneContext'
import type { RootState } from '@/redux/store'

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
  type MouseState,
} from './helpers'

const MainCamera = () => {
  const [, setTick] = useState(0)

  //TODO: review this condition
  const context = useContext(SceneContext)
  if (!context) {
    throw new Error('MainCamera must be used within a SceneContext.Provider')
  }
  const { wallRefs, windowRefs, glassRefs } = context

  // State refs
  const keysPressed = useRef<Record<string, boolean>>({})
  const mouseState: RefObject<MouseState> = useRef(createMouseState())
  const initialPositionSet = useRef(false)
  const rotationVelocity = useRef(0)
  const fov = useRef(70)

  // constants
  const dampingFactor = 0.6
  const collisionDistance = 1
  const moveSpeed = 0.03
  const cameraElevation = 1.1

  // Redux state
  const wallCoordinates = useSelector((state: RootState) => state.wallView.currentWallCoordinates)
  const wallNormal = useSelector((state: RootState) => state.wallView.currentWallNormal)

  // handlers
  const onMouseMove = useCallback(
    (event: MouseEvent) => handleMouseMove(mouseState, setTick)(event),
    [mouseState],
  )
  const onMouseDown = useCallback(
    (event: MouseEvent) => attachMouseHandlers(onMouseMove, mouseState)(event),
    [onMouseMove],
  )
  const onMouseUp = useCallback(
    (event: MouseEvent) => detachMouseHandlers(onMouseMove, mouseState)(event),
    [onMouseMove],
  )
  const onTouchMove = useCallback(
    (event: TouchEvent) => handleTouchMove(mouseState, setTick)(event),
    [mouseState],
  )
  const onTouchStart = useCallback(
    (event: TouchEvent) => attachTouchHandlers(onTouchMove, mouseState)(event),
    [onTouchMove],
  )
  const onTouchEnd = useCallback(
    () => detachTouchHandlers(onTouchMove, mouseState)(),
    [onTouchMove],
  )
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => handleKeyPress(keysPressed, event.key, true),
    [],
  )
  const onKeyUp = useCallback(
    (event: KeyboardEvent) => handleKeyPress(keysPressed, event.key, false),
    [],
  )

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
    const cam = camera as PerspectiveCamera

    cam.fov = fov.current
    cam.updateProjectionMatrix()

    if (!initialPositionSet.current) {
      if (wallCoordinates && wallNormal) {
        const lookAt = new Vector3(wallCoordinates.x, cameraElevation, wallCoordinates.z)
        const offsetDistance = 5
        const offset = new Vector3(wallNormal.x * offsetDistance, 0, wallNormal.z * offsetDistance)
        const cameraPosition = lookAt.clone().add(offset)

        cam.position.set(cameraPosition.x, cameraElevation, cameraPosition.z)
        cam.lookAt(lookAt)
        cam.updateProjectionMatrix()
      }

      initialPositionSet.current = true
    }

    if (Math.abs(mouseState.current?.deltaX ?? 0) > 0.5) {
      rotationVelocity.current += (mouseState.current?.deltaX ?? 0) * 0.002
    }

    rotationVelocity.current *= dampingFactor

    const rotationDelta = -rotationVelocity.current
    cam.rotateY(rotationDelta)

    const moveVector = calculateMovementVector(keysPressed, moveSpeed, cam)

    if (!detectCollisions(cam, moveVector, wallRefs, windowRefs, glassRefs, collisionDistance)) {
      cam.position.add(moveVector)
    }

    if (mouseState.current) {
      mouseState.current.deltaX = 0
    }
  })

  return null
}

export default MainCamera
