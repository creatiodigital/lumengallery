import styles from './LeftPanel.module.scss'

// import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'

import { useDispatch, useSelector } from 'react-redux'
// import {
//   hideWizard,
//   setArtworkUploadedTrue,
//   setArtworkUploadedFalse,
// } from '@/lib/features/wizardSlice'
// import { editArtwork, editArtworkUrlImage } from '@/lib/features/artistSlice'

// import { Button } from '@/components/ui/Button'

export const LeftPanel = ({
  handleSaveWallView,
  zoomIn,
  zoomOut,
  resetPan,
}) => {
  // const artworks = useSelector((state) => state.artist.artworks)
  // const currentArtworkId = useSelector(
  //   (state) => state.wallView.currentArtworkId,
  // )

  // console.log('currentArtworkId', currentArtworkId)

  return (
    <div className={styles.leftPanel}>
      <Button onClick={handleSaveWallView}>Save</Button>
      <Button onClick={zoomIn}>+</Button>
      <Button onClick={zoomOut}>-</Button>
      <Button onClick={resetPan}>Reset Pan</Button>
    </div>
  )
}
