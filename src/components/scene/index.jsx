'use client'

import { Canvas } from '@react-three/fiber'
import React, { useRef, Suspense } from 'react'
import { useSelector } from 'react-redux'
import { ACESFilmicToneMapping } from 'three'

import { Loader } from '@/components/ui/Loader'
import SceneContext from '@/contexts/SceneContext'

import Controls from './controls'
import { Elements } from './elements'
import styles from './Scene.module.scss'

export const Scene = () => {
  const wallRefs = useRef([])
  const windowRefs = useRef([])
  const glassRefs = useRef([])
  const artworks = useSelector((state) => state.artist.arworks)

  return (
    <SceneContext.Provider value={{ wallRefs, windowRefs, glassRefs }}>
      <div className={styles.scene}>
        <Canvas
          shadows
          gl={{
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 0.9,
          }}
        >
          <Suspense fallback={<Loader />}>
            <group>
              <Controls />
              <Elements artworks={artworks} isSpace />
            </group>
          </Suspense>
        </Canvas>
      </div>
    </SceneContext.Provider>
  )
}
