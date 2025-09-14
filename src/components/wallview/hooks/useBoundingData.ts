import { useEffect, useState } from 'react'
import { Box3 } from 'three'

import { calculateAverageNormal, calculateDimensionsAndBasis } from '@/components/wallview/utils'
import type { TDimensions } from '@/types/geometry'

type TBoundingData = TDimensions & {
  boundingBox: Box3
  normal: { x: number; y: number; z: number }
}

export const useBoundingData = (
  nodes: Record<string, any>,
  currentWallId: string | null,
): TBoundingData | null => {
  const [boundingData, setBoundingData] = useState<TBoundingData | null>(null)

  useEffect(() => {
    const currentWall = Object.values(nodes).find((obj: any) => obj.uuid === currentWallId)

    if (currentWall?.geometry?.boundingBox) {
      const boundingBox = currentWall.geometry.boundingBox as Box3
      const normal = calculateAverageNormal(currentWall)
      const dimensions = calculateDimensionsAndBasis(boundingBox, normal)
      console.log('xxx', dimensions)
      setBoundingData({ ...dimensions, boundingBox, normal })
    }
  }, [currentWallId, nodes])

  return boundingData
}
