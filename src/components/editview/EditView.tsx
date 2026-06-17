'use client'

import { useSelector } from 'react-redux'

import { ArtworkPanel } from '@/components/editview/ArtworkPanel'
import { CameraPanel } from '@/components/editview/CameraPanel'
import { FloorPanel } from '@/components/editview/FloorPanel'
import { LightingPanel } from '@/components/editview/LightingPanel'
import WallCeilingPanel from '@/components/editview/WallCeilingPanel/WallCeilingPanel'
import { Scene } from '@/components/scene'
import { WallView } from '@/components/wallview'
import type { RootState } from '@/redux/store'

import { Menu } from './Menu'

function EditView() {
  const isWallView: boolean = useSelector((state: RootState) => state.wallView.isWallView)
  const isArtworkPanelOpen: boolean = useSelector(
    (state: RootState) => state.dashboard.isArtworkPanelOpen,
  )
  const isLightingPanelOpen: boolean = useSelector(
    (state: RootState) => state.dashboard.isLightingPanelOpen,
  )
  const isFloorPanelOpen: boolean = useSelector(
    (state: RootState) => state.dashboard.isFloorPanelOpen,
  )
  const isCameraPanelOpen: boolean = useSelector(
    (state: RootState) => state.dashboard.isCameraPanelOpen,
  )

  const isWallCeilingPanelOpen: boolean = useSelector(
    (state: RootState) => state.dashboard.isWallCeilingPanelOpen,
  )

  return (
    <>
      {!isWallView && (
        <div>
          <Menu />
          <Scene />
          {isArtworkPanelOpen && <ArtworkPanel />}
          {isLightingPanelOpen && <LightingPanel />}
          {isFloorPanelOpen && <FloorPanel />}
          {isCameraPanelOpen && <CameraPanel />}

          {isWallCeilingPanelOpen && <WallCeilingPanel />}
        </div>
      )}
      {isWallView && <WallView />}
    </>
  )
}

export default EditView
