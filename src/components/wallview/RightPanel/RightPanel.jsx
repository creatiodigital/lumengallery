import { useGLTF } from '@react-three/drei'
import React from 'react'
import { useSelector } from 'react-redux'

import { ArtisticImagePanel } from './ArtisticImagePanel'
import { ArtisticTextPanel } from './ArtisticTextPanel'
import { ArtworkPanel } from './ArtworkPanel'
import { GroupPanel } from './GroupPanel'
import { useArtworkDetails } from './hooks/useArtworkDetails'
import styles from './RightPanel.module.scss'

const RightPanel = () => {
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)

  const { artworkType } = useArtworkDetails(currentArtworkId)

  const isGroupCreated = artworkGroupIds.length > 1

  return (
    <div className={styles.panel}>
      <div className={styles.properties}>
        {isGroupCreated && <GroupPanel />}
        {!isGroupCreated && isWizardOpen && (
          <>
            <ArtworkPanel />
            {artworkType === 'paint' && <ArtisticImagePanel />}
            {artworkType === 'text' && <ArtisticTextPanel />}
          </>
        )}
      </div>
    </div>
  )
}

useGLTF.preload('/assets/galleries/perrotin1glb')

export default RightPanel
