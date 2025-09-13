import React from 'react'
import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

import { ArtisticImagePanel } from './ArtisticImagePanel'
import { ArtisticTextPanel } from './ArtisticTextPanel'
import { ArtworkPanel } from './ArtworkPanel'
import { GroupPanel } from './GroupPanel'
import { useArtworkDetails } from './hooks/useArtworkDetails'
import styles from './RightPanel.module.scss'

const RightPanel = () => {
  const isWizardOpen = useSelector((state: RootState) => state.wizard.isWizardOpen)
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)

  const { artworkType } = useArtworkDetails(currentArtworkId!)

  const isGroupCreated = artworkGroupIds.length > 1

  return (
    <div className={styles.panel}>
      <div className={styles.properties}>
        {isGroupCreated && <GroupPanel />}
        {!isGroupCreated && isWizardOpen && (
          <>
            <ArtworkPanel />
            {artworkType === 'image' && <ArtisticImagePanel />}
            {artworkType === 'text' && <ArtisticTextPanel />}
          </>
        )}
      </div>
    </div>
  )
}

export default RightPanel
