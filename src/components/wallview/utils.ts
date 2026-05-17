import type { ChangeEvent } from 'react'
import { Vector3, Quaternion, Mesh, BufferGeometry, Box3 } from 'three'

import { WALL_SCALE } from '@/components/wallview/constants'
import type { TArtwork, TArtworkPosition } from '@/types/artwork'
import type { TDimensions } from '@/types/geometry'

// NumberInput passes synthetic events whose target.value is a string.
// Position handlers in useArtworkHandlers / useGroupHandlers parse that
// value as metres. Inputs now display centimetres, so convert at the
// edge before forwarding the event.
export const cmEventToMeters = (
  e: ChangeEvent<HTMLInputElement>,
): ChangeEvent<HTMLInputElement> => {
  const cm = parseFloat(String(e.target.value).replace(',', '.'))
  if (!Number.isFinite(cm)) return e
  return {
    ...e,
    target: { ...e.target, value: String(cm / 100) },
  } as ChangeEvent<HTMLInputElement>
}

/**
 * Compute the visual bounding rect of an artwork, including its
 * frame and passepartout borders (which grow outward from the image).
 * For rotated shapes, computes the axis-aligned bounding box (AABB).
 *
 * Returns { x, y, width, height } in 2D wall-view pixel units.
 * When no artwork metadata is available, falls back to the raw image rect.
 */
export const getVisualBounds = (
  pos: TArtworkPosition,
  artwork: TArtwork | undefined,
): { x: number; y: number; width: number; height: number } => {
  const scaleMul = WALL_SCALE / 100
  const frameBorder =
    artwork?.showFrame && artwork?.imageUrl && artwork?.frameSize?.value
      ? artwork.frameSize.value * scaleMul
      : 0
  const ppBorder =
    artwork?.showPassepartout && artwork?.imageUrl && artwork?.passepartoutSize?.value
      ? artwork.passepartoutSize.value * scaleMul
      : 0
  const totalBorder = frameBorder + ppBorder

  let w = pos.width2d + totalBorder * 2
  let h = pos.height2d + totalBorder * 2
  let x = pos.posX2d - totalBorder
  let y = pos.posY2d - totalBorder

  // For rotated shapes, expand to AABB
  const rotationDeg = artwork?.artworkType === 'shape' ? (pos.rotation ?? 0) : 0
  if (rotationDeg !== 0) {
    const rad = (rotationDeg * Math.PI) / 180
    const cosA = Math.abs(Math.cos(rad))
    const sinA = Math.abs(Math.sin(rad))
    const aabbW = w * cosA + h * sinA
    const aabbH = w * sinA + h * cosA
    // Center stays the same, adjust x/y
    const cx = x + w / 2
    const cy = y + h / 2
    x = cx - aabbW / 2
    y = cy - aabbH / 2
    w = aabbW
    h = aabbH
  }

  return { x, y, width: w, height: h }
}

export const calculateAverageNormal = (placeholder: Mesh<BufferGeometry>): Vector3 => {
  const normal = new Vector3(0, 0, 0)

  // Defensive check for geometry attributes
  if (!placeholder.geometry?.attributes?.normal?.array) {
    console.warn('calculateAverageNormal: geometry normal attributes not available')
    return normal.set(0, 0, 1) // Default to facing +Z
  }

  const normalsArray = placeholder.geometry.attributes.normal.array as Float32Array

  for (let i = 0; i < normalsArray.length; i += 3) {
    normal.x += normalsArray[i]
    normal.y += normalsArray[i + 1]
    normal.z += normalsArray[i + 2]
  }

  return normal.normalize()
}

export const calculateDimensionsAndBasis = (boundingBox: Box3, normal: Vector3) => {
  const u = new Vector3()
  const v = new Vector3()

  // Check if normal is valid (non-zero)
  const normalLength = normal.length()
  if (!Number.isFinite(normalLength) || normalLength === 0) {
    console.warn('calculateDimensionsAndBasis: Invalid normal vector, using default')
    normal.set(0, 0, 1)
  }

  if (Math.abs(normal.y) < 1) {
    u.crossVectors(normal, new Vector3(0, 1, 0))
  } else {
    u.crossVectors(normal, new Vector3(1, 0, 0))
  }

  // Ensure u is valid before normalizing
  if (u.length() > 0) {
    u.normalize()
  } else {
    u.set(1, 0, 0)
  }

  v.crossVectors(normal, u)
  if (v.length() > 0) {
    v.normalize()
  } else {
    v.set(0, 1, 0)
  }

  const size = new Vector3()
  boundingBox.getSize(size)

  // Fallback if size is invalid
  if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z)) {
    console.warn('calculateDimensionsAndBasis: Invalid bounding box size')
    return { width: 0, height: 0, u, v }
  }

  let width = Math.abs(size.dot(u))
  let height = Math.abs(size.dot(v))

  // If projection gives zero, use bounding box dimensions directly
  // (happens when normals aren't available from compressed GLBs)
  if (width === 0 || height === 0) {
    // For vertical walls, width is typically X or Z, height is Y
    const maxHorizontal = Math.max(size.x, size.z)
    width = width === 0 ? maxHorizontal : width
    height = height === 0 ? size.y : height

    // Reset basis vectors for direct bounding box usage
    if (size.x >= size.z) {
      u.set(1, 0, 0)
    } else {
      u.set(0, 0, 1)
    }
    v.set(0, 1, 0)
  }

  return { width, height, u, v }
}

export const convert2DTo3D = (
  posX2d: number,
  posY2d: number,
  width2d: number,
  height2d: number,
  boundingData: TDimensions,
) => {
  const { boundingBox, normal, u, v, width, height } = boundingData

  const xRatio = 0.5 - posX2d / (width * WALL_SCALE)
  const yRatio = posY2d / (height * WALL_SCALE) - 0.5

  const center3D = boundingBox.getCenter(new Vector3())

  // Snap center to the front face of the placeholder along the normal.
  // boundingBox.getCenter() returns the volumetric center, which is offset
  // from the wall surface if the placeholder has geometric depth.
  // Project to the max extent along the normal (front face = wall surface).
  const normalVec = new Vector3(normal.x, normal.y, normal.z)
  const centerDotN = center3D.dot(normalVec)
  const frontDotN = Math.max(boundingBox.min.dot(normalVec), boundingBox.max.dot(normalVec))
  center3D.addScaledVector(normalVec, frontDotN - centerDotN)

  let posX3d = center3D.x + u.x * xRatio * width + v.x * yRatio * height
  let posY3d = center3D.y + u.y * xRatio * width + v.y * yRatio * height
  let posZ3d = center3D.z + u.z * xRatio * width + v.z * yRatio * height

  const adjustedWidth = (width2d / (width * WALL_SCALE)) * width
  const adjustedHeight = (height2d / (height * WALL_SCALE)) * height

  posX3d -= u.x * (adjustedWidth / 2)
  posY3d -= u.y * (adjustedWidth / 2)
  posZ3d -= u.z * (adjustedWidth / 2)

  posX3d += v.x * (adjustedHeight / 2)
  posY3d += v.y * (adjustedHeight / 2)
  posZ3d += v.z * (adjustedHeight / 2)

  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal)

  return {
    posX3d,
    posY3d,
    posZ3d,
    quaternionX: quaternion.x,
    quaternionY: quaternion.y,
    quaternionZ: quaternion.z,
    quaternionW: quaternion.w,
    width3d: adjustedWidth,
    height3d: adjustedHeight,
  }
}
