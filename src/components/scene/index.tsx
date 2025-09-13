'use client'

import { Canvas } from '@react-three/fiber'
import React, { useRef, Suspense } from 'react'
import { ACESFilmicToneMapping, Mesh } from 'three'

import { Loader } from '@/components/ui/Loader'
import SceneContext from '@/contexts/SceneContext'

import Controls from './controls'
import styles from './Scene.module.scss'
import { Space } from './Space'
import type { TArtwork } from '@/types/artwork'

export const Scene = () => {
  const wallRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const windowRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const glassRefs = useRef<React.RefObject<Mesh | null>[]>([])

  // Placeholder props — you can replace these with actual values from Redux or parent
  const handlePlaceholderClick = (wallId: string) => {
    console.log('Clicked placeholder on wall:', wallId)
  }

  const artworks: TArtwork[] = [] // Replace with real artworks

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
