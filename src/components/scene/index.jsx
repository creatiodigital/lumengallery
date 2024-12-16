'use client'

import { Canvas } from '@react-three/fiber'
import React, { useRef } from 'react'
import { useSelector } from 'react-redux'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'

import SceneContext from '@/contexts/SceneContext'

import Controls from './controls'
import Elements from './elements'
import styles from './Scene.module.scss'

const Scene = () => {
  const wallRefs = useRef([])
  const artworks = useSelector((state) => state.artist.arworks)

  return (
    <SceneContext.Provider value={{ wallRefs }}>
      <div className={styles.scene}>
        <Canvas
          gl={{
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1,
            outputColorSpace: SRGBColorSpace,
            antialias: true,
          }}
        >
          <group>
            <Controls />
            <Elements artworks={artworks} isSpace />
          </group>
        </Canvas>
      </div>
    </SceneContext.Provider>
  )
}

export default Scene
