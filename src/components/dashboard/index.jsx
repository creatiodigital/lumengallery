'use client'

//TODO: rename, re-organize, split

import { Canvas } from '@react-three/fiber'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'

import Controls from '@/components/scene/controls'
import { Elements } from '@/components/scene/elements'
import { Button } from '@/components/ui/Button'
import { WallView } from '@/components/wallview'
import { LeftPanel } from '@/components/wallview/LeftPanel'
import { RightPanel } from '@/components/wallview/RightPanel'
import SceneContext from '@/contexts/SceneContext'
import { setHandler } from '@/lib/features/artistSlice'
import { showEditMode, hideEditMode } from '@/lib/features/dashboardSlice'
import { showWallView } from '@/lib/features/wallViewSlice'

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

  useEffect(() => {
    if (handler) {
      dispatch(setHandler(handler))
    }
  }, [handler, dispatch])

  const handleEditGallery = () => {
    dispatch(showEditMode())
  }

  const handlePlaceholderClick = (mesh) => {
    dispatch(showWallView(mesh.uuid))
  }

  return (
    <>
      {artist.handler && (
        <div className={styles.dashboard}>
          <div className={styles.main}>
            {!isEditMode && <Button onClick={handleEditGallery}>Edit Gallery</Button>}
            {isEditMode && !isWallView && (
              <div className={styles.editMode}>
                <div className={styles.editModeHeader}>
                  <Button onClick={() => dispatch(hideEditMode())}>Close Edit Mode</Button>
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
                          onPlaceholderClick={handlePlaceholderClick}
                          artworks={artworks}
                          wallRefs={wallRefs.current}
                        />
                      </group>
                    </Canvas>
                  </div>
                </SceneContext.Provider>
              </div>
            )}
          </div>
          {isWallView && (
            <div className={styles.walls}>
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
