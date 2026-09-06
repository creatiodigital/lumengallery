'use client'

import { useDispatch, useSelector } from 'react-redux'

import { ArtworkPanel } from '@/components/editview/ArtworkPanel'
import { CameraPanel } from '@/components/editview/CameraPanel'
import { FloorPanel } from '@/components/editview/FloorPanel'
import { LightingPanel } from '@/components/editview/LightingPanel'
import WallCeilingPanel from '@/components/editview/WallCeilingPanel/WallCeilingPanel'
import { ExitPrompt } from '@/components/exhibitions/ExitPrompt'
import { Scene } from '@/components/scene'
import { WallView } from '@/components/wallview'
import { declineExit } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import { Menu } from './Menu'

function EditView() {
  const dispatch = useDispatch()
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

  // The scene mounts `ExitTrigger` here exactly as it does for a visitor, so
  // walking to the end of the entrance corridor raises the prompt in the editor
  // too. The dialog has to be rendered alongside it: `MainCamera` freezes the
  // camera for as long as `isExitPromptOpen` is set, and only this dialog
  // clears it — without it the artist reaches the corridor and simply stops.
  const isExitPromptOpen: boolean = useSelector((state: RootState) => state.scene.isExitPromptOpen)

  // Leaving the editor means the same thing here as it does on `Menu`'s close
  // button: back to the dashboard, wall view reset so the next exhibition does
  // not open onto stale state.
  const leave = () => {
    dispatch(resetWallView())
    window.location.href = '/dashboard'
  }

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

          <ExitPrompt
            open={isExitPromptOpen}
            onLeave={leave}
            onCancel={() => dispatch(declineExit())}
          />
        </div>
      )}
      {isWallView && <WallView />}
    </>
  )
}

export default EditView
