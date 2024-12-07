'use client'

//TODO:
// Move drag, zoom logic to redux
// Implement handlers for resizing
// Update space after saving
// Decice upon material ui / custom / icon set
// Show added artworks on left panel
// Add Metadata (title, info)
// Show metadata in edit mode and space view
// Clean up, abstract out calculation function. Add helpers
// Rename / Reorganize slices
// Calculate initial zoom factor based on wall dimensions
// Test on laptop view
// Redesign layout, left and right panels

import styles from './dashboard.module.scss'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { usePathname } from 'next/navigation'
import { showEditMode, hideEditMode } from '@/lib/features/dashboardSlice'
import { showWallView, hideWallView } from '@/lib/features/wallViewSlice'
import { setHandler } from '@/lib/features/artistSlice'

import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import React, { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Button } from '@/components/ui/Button'
import SceneContext from '@/contexts/SceneContext'
import { Controls } from '@/components/scene/controls'
import { Elements } from '@/components/scene/elements'
import threeStyles from '@/styles/modules/threejs.module.scss'
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
  const [scaleFactor, setScaleFactor] = useState(1)
  const [panPosition, setPanPosition] = useState({ x: -50, y: -50 }) // Manage pan position in the parent
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

  const handleSaveWallView = () => {
    dispatch(hideWallView())
    dispatch(showEditMode())
  }

  const handleZoomIn = () => {
    setScaleFactor((prev) => Math.min(prev + 0.02, 1.5))
  }

  const handleZoomOut = () => {
    setScaleFactor((prev) => Math.max(prev - 0.02, 0.54))
  }

  const handleResetPan = () => {
    // Reset pan position to the initial state
    setPanPosition({ x: -50, y: -50 })
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
            <div className={styles.wallDashboard}>
              <LeftPanel
                handleSaveWallView={handleSaveWallView}
                zoomIn={handleZoomIn}
                zoomOut={handleZoomOut}
                resetPan={handleResetPan}
              />
              <WallView
                scaleFactor={scaleFactor}
                panPosition={panPosition} // Pass pan position
                setPanPosition={setPanPosition} // Pass setter to WallView
              />
              <RightPanel />
            </div>
          )}
        </div>
      )}
    </>
  )
}
