'use client'

import { Canvas } from '@react-three/fiber'
import React, { useRef, Suspense } from 'react'
import { ACESFilmicToneMapping, Mesh } from 'three'

import { Loader } from '@/components/ui/Loader'
import SceneContext from '@/contexts/SceneContext'
import type { TArtwork } from '@/types/artwork'

import Controls from './controls'
import styles from './Scene.module.scss'
import { Space } from './Space'

export const Scene = () => {
  const wallRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const windowRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const glassRefs = useRef<React.RefObject<Mesh | null>[]>([])

  const handlePlaceholderClick = (wallId: string) => {
    console.log('Clicked placeholder on wall:', wallId)
  }

  const artworks: TArtwork[] = []

  return (
    <SceneContext.Provider value={{ wallRefs, windowRefs, glassRefs }}>
      <div className={styles.scene}>
        <Canvas
          shadows
          gl={{
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1,
          }}
        >
          <Suspense fallback={<Loader />}>
            <group>
              <Controls />
              <Space onPlaceholderClick={handlePlaceholderClick} artworks={artworks} />
            </group>
          </Suspense>
        </Canvas>
      </div>
    </SceneContext.Provider>
  )
}
