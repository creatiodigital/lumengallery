'use client'

import { useMemo } from 'react'

import { useGLTF } from '@react-three/drei'
import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'
import { assetUrl } from '@/lib/assetUrl'

const HUMAN_MODEL_PATH = assetUrl('/assets/human.glb')

const HumanReference = () => {
  const isHumanVisible = useSelector((state: RootState) => state.scene.isHumanVisible)
  const humanPositionX = useSelector((state: RootState) => state.scene.humanPositionX)
  const humanPositionZ = useSelector((state: RootState) => state.scene.humanPositionZ)
  const humanRotationY = useSelector((state: RootState) => state.scene.humanRotationY)
  const { scene } = useGLTF(HUMAN_MODEL_PATH)
  const clonedScene = useMemo(() => scene.clone(), [scene])

  if (!isHumanVisible) return null

  return (
    <primitive
      object={clonedScene}
      position={[humanPositionX, 0, humanPositionZ]}
      rotation={[0, (humanRotationY * Math.PI) / 180, 0]}
      scale={1}
    />
  )
}

// Preload the model
useGLTF.preload(HUMAN_MODEL_PATH)

export default HumanReference
