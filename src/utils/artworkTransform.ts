import { Vector3, Quaternion } from 'three'

import type { TArtwork, TArtworkPosition } from '@/types/artwork'

export function getArtworkPosition3D(pos: TArtworkPosition): Vector3 {
  return new Vector3(pos.posX3d, pos.posY3d, pos.posZ3d)
}

export function getArtworkQuaternion(pos: TArtworkPosition): Quaternion {
  return new Quaternion(pos.quaternionX, pos.quaternionY, pos.quaternionZ, pos.quaternionW)
}

export function getArtworkDimensions3D(pos: TArtworkPosition) {
  return {
    width: pos.width3d ?? pos.width2d ?? 1,
    height: pos.height3d ?? pos.height2d ?? 1,
  }
}

export type RuntimeArtwork = TArtwork & {
  position: Vector3
  quaternion: Quaternion
  width: number
  height: number
}

export function toRuntimeArtwork(artwork: TArtwork, pos: TArtworkPosition): RuntimeArtwork {
  const { width, height } = getArtworkDimensions3D(pos)

  return {
    ...artwork,
    position: getArtworkPosition3D(pos),
    quaternion: getArtworkQuaternion(pos),
    width,
    height,
  }
}
