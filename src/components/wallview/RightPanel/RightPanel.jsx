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

  const { TArtwork } = useArtworkDetails(currentArtworkId)

  const isGroupCreated = artworkGroupIds.length > 1

  return (
    <div className={styles.panel}>
      <div className={styles.properties}>
        {isGroupCreated && <GroupPanel />}
        {!isGroupCreated && isWizardOpen && (
          <>
            <ArtworkPanel />
            {TArtwork === 'image' && <ArtisticImagePanel />}
            {TArtwork === 'text' && <ArtisticTextPanel />}
          </>
        )}
      </div>
    </div>
  )
}

export default RightPanel
