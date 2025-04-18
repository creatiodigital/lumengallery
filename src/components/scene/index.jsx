'use client'

import { Canvas } from '@react-three/fiber'
import React, { useRef, Suspense } from 'react'
import { ACESFilmicToneMapping } from 'three'

import { Loader } from '@/components/ui/Loader'
import SceneContext from '@/contexts/SceneContext'

import Controls from './controls'
import styles from './Scene.module.scss'
import { Space } from './Space'

export const Scene = () => {
  const wallRefs = useRef([])
  const windowRefs = useRef([])
  const glassRefs = useRef([])

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
              <Space isSpace />
            </group>
          </Suspense>
        </Canvas>
      </div>
    </SceneContext.Provider>
  )
}
