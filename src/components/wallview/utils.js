import { Vector3, Quaternion } from 'three'

export const calculateAverageNormal = (placeholder) => {
  const normalsArray = placeholder.geometry.attributes.normal.array
  const normal = new Vector3(0, 0, 0)
  for (let i = 0; i < normalsArray.length; i += 3) {
    normal.x += normalsArray[i]
    normal.y += normalsArray[i + 1]
    normal.z += normalsArray[i + 2]
  }
  return normal.normalize()
}

export const calculateDimensionsAndBasis = (boundingBox, normal) => {
  const u = new Vector3()
  const v = new Vector3()
  if (Math.abs(normal.y) < 1) {
    u.crossVectors(normal, new Vector3(0, 1, 0)).normalize()
  } else {
    u.crossVectors(normal, new Vector3(1, 0, 0)).normalize()
  }
  v.crossVectors(normal, u).normalize()
  const size = new Vector3()
  boundingBox.getSize(size)
  const width = Math.abs(size.dot(u))
  const height = Math.abs(size.dot(v))
  return { width, height, u, v }
}

export const convert2DTo3D = ({ x, y, size }, boundingData) => {
  const { boundingBox, normal, u, v, width, height } = boundingData
  const { w, h } = size

  const xRatio = 0.5 - x / (width * 100)
  const yRatio = y / (height * 100) - 0.5

  const center3D = boundingBox.getCenter(new Vector3())

  let x3D = center3D.x + u.x * xRatio * width + v.x * yRatio * height
  let y3D = center3D.y + u.y * xRatio * width + v.y * yRatio * height
  let z3D = center3D.z + u.z * xRatio * width + v.z * yRatio * height

  const adjustedWidth = (w / (width * 100)) * width
  const adjustedHeight = (h / (height * 100)) * height

  x3D -= u.x * (adjustedWidth / 2)
  y3D -= u.y * (adjustedWidth / 2)
  z3D -= u.z * (adjustedWidth / 2)

  x3D += v.x * (adjustedHeight / 2)
  y3D += v.y * (adjustedHeight / 2)
  z3D += v.z * (adjustedHeight / 2)

  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal)

  return {
    position: {
      x: x3D,
      y: y3D,
      z: z3D,
    },
    quaternion: {
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w,
    },
    width: adjustedWidth,
    height: adjustedHeight,
  }
}
export const convert2DTo3DE = ({ x, y, size }, boundingData) => {
  const { boundingBox, normal, u, v, width, height } = boundingData
  const { w, h } = size

  const xRatio = 0.5 - x / (width * 100)
  const yRatio = y / (height * 100) - 0.5

  const center3D = boundingBox.getCenter(new Vector3())

  let posX3d = center3D.x + u.x * xRatio * width + v.x * yRatio * height
  let posY3d = center3D.y + u.y * xRatio * width + v.y * yRatio * height
  let posZ3d = center3D.z + u.z * xRatio * width + v.z * yRatio * height

  const adjustedWidth = (w / (width * 100)) * width
  const adjustedHeight = (h / (height * 100)) * height

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
