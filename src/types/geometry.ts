import { Box3, Vector3 } from 'three'

export type TDimensions = {
  width: number
  height: number
  u: Vector3
  v: Vector3
  boundingBox: Box3
  normal: Vector3
}
