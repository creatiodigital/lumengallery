import * as THREE from 'three'

export const createMouseState = () => ({
  isLeftButtonPressed: false,
  lastMouseX: null,
  deltaX: 0,
})

export const handleMouseMove = (mouseState, setTick) => (event) => {
  if (!mouseState.current.isLeftButtonPressed) return
  const currentX = event.clientX
  const deltaX = currentX - mouseState.current.lastMouseX
  mouseState.current.deltaX = deltaX
  mouseState.current.lastMouseX = currentX
  setTick((tick) => tick + 1)
}

export const handleKeyPress = (keysPressed, key, isPressed) => {
  keysPressed.current[key.toLowerCase()] = isPressed
}

export const attachMouseHandlers = (handleMouseMove, mouseState) => (event) => {
  if (event.button === 0) {
    mouseState.current = {
      ...mouseState.current,
      isLeftButtonPressed: true,
      lastMouseX: event.clientX,
      deltaX: 0,
    }
    window.addEventListener('mousemove', handleMouseMove)
  }
}

export const detachMouseHandlers = (handleMouseMove, mouseState) => (event) => {
  if (event.button === 0) {
    mouseState.current.isLeftButtonPressed = false
    mouseState.current.deltaX = 0
    window.removeEventListener('mousemove', handleMouseMove)
  }
}

export const calculateMovementVector = (keysPressed, moveSpeed, camera) => {
  const moveVector = new THREE.Vector3()

  if (keysPressed.current['w']) moveVector.z -= 1
  if (keysPressed.current['s']) moveVector.z += 1
  if (keysPressed.current['a']) moveVector.x -= 1
  if (keysPressed.current['d']) moveVector.x += 1

  if (moveVector.lengthSq() > 0) {
    moveVector.normalize().multiplyScalar(moveSpeed)

    moveVector.applyQuaternion(camera.quaternion)
  }

  return moveVector
}

export const detectCollisions = (
  camera,
  moveVector,
  wallRefs,
  collisionDistance = 2,
) => {
  const direction = new THREE.Vector3().copy(moveVector).normalize()
  const raycaster = new THREE.Raycaster(camera.position, direction, 0, 3)

  let collisionDetected = false
  wallRefs.current.forEach((ref) => {
    if (ref.current) {
      const intersections = raycaster.intersectObject(ref.current, true)
      if (
        intersections.length > 0 &&
        intersections[0].distance <= collisionDistance
      ) {
        collisionDetected = true
      }
    }
  })

  return collisionDetected
}
