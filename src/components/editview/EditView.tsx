'use client'

import React from 'react'
import { useSelector } from 'react-redux'

import { ArtworkPanel } from '@/components/editview/ArtworkPanel'
import { Scene } from '@/components/scene'
import { WallView } from '@/components/wallview'
import type { RootState } from '@/redux/store'

import { Menu } from './Menu'

function EditView() {
  const isWallView: boolean = useSelector((state: RootState) => state.wallView.isWallView)
  const isArtworkPanelOpen: boolean = useSelector(
    (state: RootState) => state.dashboard.isArtworkPanelOpen,
  )
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
