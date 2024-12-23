import { useEffect, useState } from 'react'

import { calculateAverageNormal, calculateDimensionsAndBasis } from '../utils'

export const useBoundingData = (nodes, currentWallId) => {
  const [boundingData, setBoundingData] = useState(null)

  useEffect(() => {
    const currentWall = Object.values(nodes).find((obj) => obj.uuid === currentWallId)

    if (currentWall?.geometry?.boundingBox) {
      const boundingBox = currentWall.geometry.boundingBox
      const normal = calculateAverageNormal(currentWall)
      const dimensions = calculateDimensionsAndBasis(boundingBox, normal)
      setBoundingData({ ...dimensions, boundingBox, normal })
    }
  }, [currentWallId, nodes])

  return boundingData
}
