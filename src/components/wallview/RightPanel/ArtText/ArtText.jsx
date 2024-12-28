import React from 'react'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { ColorPicker } from '@/components/ui/ColorPicker'

import styles from '../RightPanel.module.scss'
import { useArtworkDetails } from '../useArtworkDetails'
import { useArtworkHandlers } from '../useArtworkHandlers'

const ArtText = () => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { handleTextAlign, handleColorSelect } = useArtworkHandlers(currentArtworkId)

  const { artisticTextStyles } = useArtworkDetails(currentArtworkId)

  const color = artisticTextStyles?.color ?? '#000000'

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Text Styles</h2>
      <div className={styles.subsection}>
        <h3 className={styles.subtitle}>Alignment</h3>
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
      <div className={styles.subsection}>
        <h3 className={styles.subtitle}>Color</h3>
        <div className={styles.row}>
          <div className={styles.item}>
            <ColorPicker textColor={color} onColorSelect={handleColorSelect} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArtText
