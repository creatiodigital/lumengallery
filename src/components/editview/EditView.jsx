import React from 'react'
import { useSelector } from 'react-redux'

import { Menu } from '@/components/editview/Menu'
import { ArtworkPanel } from '@/components/editview/ArtworkPanel'
import { Scene } from '@/components/scene'
import { WallView } from '@/components/wallview'

function EditView() {
  const isWallView = useSelector((state) => state.wallView.isWallView)
  const isArtworkPanelOpen = useSelector((state) => state.dashboard.isArtworkPanelOpen)
  return (
    <>
      {!isWallView && (
        <div>
          <Menu />
          <Scene />
          {isArtworkPanelOpen && <ArtworkPanel />}
        </div>
      )}
      {isWallView && <WallView />}
    </>
  )
}

export default EditView
