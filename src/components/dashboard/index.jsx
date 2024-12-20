'use client'

import { Canvas } from '@react-three/fiber'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'

import Controls from '@/components/scene/controls'
import { Elements } from '@/components/scene/elements'
import { Button } from '@/components/ui/Button'
import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { WallView } from '@/components/wallview'
import { LeftPanel } from '@/components/wallview/LeftPanel'
import { RightPanel } from '@/components/wallview/RightPanel'
import SceneContext from '@/contexts/SceneContext'
import { setHandler } from '@/lib/features/artistSlice'
import { showEditMode, hideEditMode } from '@/lib/features/dashboardSlice'

import { ArtworkPanel } from './ArtworkPanel'
import styles from './Dashboard.module.scss'

export const Dashboard = () => {
  const dispatch = useDispatch()
  const pathname = usePathname()
  const handler = pathname?.split('/')[1]
  const isEditMode = useSelector((state) => state.dashboard.isEditMode)
  const isWallView = useSelector((state) => state.wallView.isWallView)
  const artworks = useSelector((state) => state.artist.arworks)
  const artist = useSelector((state) => state.artist)

  const wallRefs = useRef([])
  const [isPlaceholdersShown, setIsPlaceholdersShown] = useState(true)

  useEffect(() => {
    if (handler) {
      dispatch(setHandler(handler))
    }
  }, [handler, dispatch])

  const handleEditGallery = () => {
    dispatch(showEditMode())
  }

  return (
    <>
      {artist.handler && (
        <div className={styles.dashboard}>
          <div className={styles.main}>
            {!isEditMode && (
              <Button type="small" onClick={handleEditGallery} label="Edit Exhibition" />
            )}
            {isEditMode && !isWallView && (
              <div>
                <div className={styles.menu}>
                  <ButtonIcon
                    icon="placeholder"
                    onClick={() => setIsPlaceholdersShown((prev) => !prev)}
                  />
                  <ButtonIcon icon="close" onClick={() => dispatch(hideEditMode())} />
                </div>
                <SceneContext.Provider value={{ wallRefs }}>
                  <div className={styles.space}>
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
                        <Elements
                          artworks={artworks}
                          wallRefs={wallRefs.current}
                          isSpace={!isPlaceholdersShown}
                        />
                      </group>
                    </Canvas>
                  </div>
                </SceneContext.Provider>
                <ArtworkPanel />
              </div>
            )}
          </div>
          {isWallView && (
            <div className={styles.panels}>
              <LeftPanel />
              <WallView />
              <RightPanel />
            </div>
          )}
        </div>
      )}
    </>
  )
}
