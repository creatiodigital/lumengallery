import React from 'react'
import { WallView } from '@/components/wallview'
import { useSelector } from 'react-redux'

import { Menu } from '@/components/dashboard/Menu'
import { Scene } from '@/components/scene'

function EditView() {
  const isEditMode = useSelector((state) => state.dashboard.isEditMode)
  const isWallView = useSelector((state) => state.wallView.isWallView)
  return (
    <>
      {isEditMode && !isWallView && (
        <div>
          <Menu />
          <Scene />
        </div>
      )}
      {isWallView && <WallView />}
    </>
  )
}

export default EditView
