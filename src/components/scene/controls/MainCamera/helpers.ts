import type { RefObject, Dispatch, SetStateAction } from 'react'
import { Vector3, Camera, Mesh, Raycaster, Quaternion } from 'three'

export type MouseState = {
  isLeftButtonPressed: boolean
  isTouchActive: boolean
  lastMouseX: number | null
  lastTouchX: number | null
  deltaX: number
}

export const createMouseState = (): MouseState => ({
  isLeftButtonPressed: false,
  isTouchActive: false,
  lastMouseX: null,
  lastTouchX: null,
  deltaX: 0,
})

export const handleMouseMove =
  (mouseState: RefObject<MouseState>, setTick: Dispatch<SetStateAction<number>>) =>
  (event: MouseEvent) => {
    if (!mouseState.current?.isLeftButtonPressed || mouseState.current.lastMouseX == null) return

    const currentX = event.clientX
    const deltaX = currentX - mouseState.current.lastMouseX
    mouseState.current.deltaX = deltaX
    mouseState.current.lastMouseX = currentX
    setTick((tick) => tick + 1)
  }

export const handleTouchMove =
  (mouseState: RefObject<MouseState>, setTick: Dispatch<SetStateAction<number>>) =>
  (event: TouchEvent) => {
    if (
      !mouseState.current?.isTouchActive ||
      mouseState.current.lastTouchX == null ||
      event.touches.length === 0
    ) {
      return
    }

    const currentX = event.touches[0]!.clientX
    const deltaX = currentX - mouseState.current.lastTouchX
    mouseState.current.deltaX = deltaX
    mouseState.current.lastTouchX = currentX
    setTick((tick) => tick + 1)
  }
export const handleKeyPress = (
  keysPressed: RefObject<Record<string, boolean>>,
  key: string,
  isPressed: boolean,
) => {
  if (!keysPressed.current) return
  keysPressed.current[key.toLowerCase()] = isPressed
}

export const attachMouseHandlers =
  (onMouseMove: (event: MouseEvent) => void, mouseState: RefObject<MouseState>) =>
  (event: MouseEvent) => {
    if (event.button === 0 && mouseState.current) {
      mouseState.current.isLeftButtonPressed = true
      mouseState.current.lastMouseX = event.clientX
      mouseState.current.deltaX = 0
      window.addEventListener('mousemove', onMouseMove)
    }
  }

export const detachMouseHandlers =
  (onMouseMove: (event: MouseEvent) => void, mouseState: RefObject<MouseState>) =>
  (event: MouseEvent) => {
    if (event.button === 0 && mouseState.current) {
      mouseState.current.isLeftButtonPressed = false
      mouseState.current.deltaX = 0
      window.removeEventListener('mousemove', onMouseMove)
    }
  }

export const attachTouchHandlers =
  (onTouchMove: (event: TouchEvent) => void, mouseState: RefObject<MouseState>) =>
  (event: TouchEvent) => {
    if (event.touches.length === 2 && mouseState.current) {
      mouseState.current.isTouchActive = true
      mouseState.current.lastTouchX = event.touches[0]!.clientX
      mouseState.current.deltaX = 0
      window.addEventListener('touchmove', onTouchMove)
    }
  }

export const detachTouchHandlers =
  (onTouchMove: (event: TouchEvent) => void, mouseState: RefObject<MouseState>) => () => {
    if (mouseState.current) {
      mouseState.current.isTouchActive = false
      mouseState.current.deltaX = 0
      window.removeEventListener('touchmove', onTouchMove)
    }
  }

export const calculateMovementVector = (
  keysPressed: RefObject<Record<string, boolean>>,
  moveSpeed: number,
  camera: Camera & { quaternion: Quaternion },
): Vector3 => {
  const moveVector = new Vector3()

  if (keysPressed.current?.['w'] || keysPressed.current?.['arrowup']) moveVector.z -= 1
  if (keysPressed.current?.['s'] || keysPressed.current?.['arrowdown']) moveVector.z += 1
  if (keysPressed.current?.['a'] || keysPressed.current?.['arrowleft']) moveVector.x -= 1
  if (keysPressed.current?.['d'] || keysPressed.current?.['arrowright']) moveVector.x += 1

  if (moveVector.lengthSq() > 0) {
    moveVector.normalize().multiplyScalar(moveSpeed)
    moveVector.applyQuaternion(camera.quaternion)
  }

  return moveVector
}

export const detectCollisions = (
  camera: Camera,
  moveVector: Vector3,
  wallRefs: RefObject<Mesh>[] = [],
  windowRefs: RefObject<Mesh>[] = [],
  glassRefs: RefObject<Mesh>[] = [],
  collisionDistance: number,
): boolean => {
  if (moveVector.lengthSq() === 0) return false // don't raycast if no movement

  const direction = new Vector3().copy(moveVector).normalize()
  const raycaster = new Raycaster(camera.position, direction, 0, 3)

  const checkCollision = (refs: RefObject<Mesh>[]) =>
    Array.isArray(refs) &&
    refs.some(
      (ref) =>
        ref.current &&
        raycaster.intersectObject(ref.current, true).some((i) => i.distance <= collisionDistance),
    )

  return checkCollision(wallRefs) || checkCollision(windowRefs) || checkCollision(glassRefs)
}
