'use client'

import styles from './dashboard.module.scss'

import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { usePathname } from 'next/navigation'
import { showEditMode, hideEditMode } from '@/lib/features/dashboardSlice'
import { showWallView } from '@/lib/features/wallViewSlice'
import { setHandler } from '@/lib/features/artistSlice'

import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import React, { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Button } from '@/components/ui/Button'
import SceneContext from '@/contexts/SceneContext'
import { Controls } from '@/components/scene/controls'
import { Elements } from '@/components/scene/elements/Elements'
import { RightPanel } from '@/components/dashboard/rightPanel/RightPanel'
import { LeftPanel } from '@/components/dashboard/leftPanel/LeftPanel'
import { WallView } from '@/components/dashboard/wallView/WallView'

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
            {!isEditMode && (
              <Button onClick={handleEditGallery}>Edit Gallery</Button>
            )}
            {isEditMode && !isWallView && (
              <div className={styles.editMode}>
                <div className={styles.editModeHeader}>
                  {isEditMode && (
                    <Button onClick={() => dispatch(hideEditMode())}>
                      Close Edit Mode
                    </Button>
                  )}
                </div>
                <div>
                  <SceneContext.Provider value={{ wallRefs }}>
                    <div>
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
              </div>
            )}
          </div>
          {isWallView && (
            <div className={styles.wallDashboard}>
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
