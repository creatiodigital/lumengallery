import React from 'react'
import { useSelector } from 'react-redux'

import { ArtworkPanel } from '@/components/editview/ArtworkPanel'
import { Scene } from '@/components/scene'
import { WallView } from '@/components/wallview'

import { Menu } from './Menu'

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
