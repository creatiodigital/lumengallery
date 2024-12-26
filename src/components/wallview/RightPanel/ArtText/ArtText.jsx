import React from 'react'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'

import styles from '../RightPanel.module.scss'
import { useArtworkHandlers } from '../useArtworkHandlers'

const ArtText = () => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { handleTextAlign } = useArtworkHandlers(currentArtworkId)

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Text Styles</h2>
      <div className={styles.subsection}>
        <h3 className={styles.subtitle}>Text Align</h3>
        <div className={styles.row}>
          <div className={styles.item}>
            <ButtonIcon icon="textLeft" onClick={() => handleTextAlign('left')} />
          </div>
          <div className={styles.item}>
            <ButtonIcon icon="textCenter" onClick={() => handleTextAlign('center')} />
          </div>
          <div className={styles.item}>
            <ButtonIcon icon="textRight" onClick={() => handleTextAlign('right')} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArtText
