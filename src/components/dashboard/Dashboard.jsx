'use client'
import { useDispatch, useSelector } from 'react-redux'
import { showEditMode, hideEditMode } from '@/lib/features/dashboardSlice'
import { showWallView, hideWallView } from '@/lib/features/wallViewSlice'
import * as styles from './dashboard.module.scss'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import React, { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Button } from '@/components/ui/Button'
import SceneContext from '@/contexts/SceneContext'
import { Controls } from '@/components/scene/controls'
import { Elements } from '@/components/scene/elements'
import threeStyles from '@/styles/modules/threejs.module.scss'
import { WallView } from './wallview'
import { Sidebar } from './sidebar'

const Dashboard = () => {
  const dispatch = useDispatch()
  const isEditMode = useSelector((state) => state.dashboard.isEditMode)
  const isWallView = useSelector((state) => state.wallView.isWallView)
  const artworks = useSelector((state) => state.artist.arworks)
  const artist = useSelector((state) => state.artist)
  const wallRefs = useRef([])

  const handleEditGallery = () => {
    dispatch(showEditMode())
  }

  const handlePlaceholderClick = (mesh) => {
    dispatch(showWallView(mesh.uuid))
  }

  const handleSaveWallView = () => {
    dispatch(hideWallView())
    dispatch(showEditMode())
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1>{`Welcome to your dashboard ${artist.name}`}</h1>
      </div>
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
                <div className={threeStyles.container}>
                  <Canvas
                    gl={{
                      toneMapping: ACESFilmicToneMapping,
                      toneMappingExposure: 3,
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
        <div className={styles.wallView}>
          <div className={styles.wallViewHeader}>
            <Button onClick={handleSaveWallView}>Save</Button>
          </div>
          <div
            style={{
              width: '100vw',
              margin: '0',
              padding: '40px 20px',
              height: '100vh',
            }}
          >
            <WallView />
          </div>
          <Sidebar />
        </div>
      )}
    </div>
  )
}

export default Dashboard
