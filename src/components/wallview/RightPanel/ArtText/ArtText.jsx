import React from 'react'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Select } from '@/components/ui/Select'
import { fontSizes, lineHeights, fontFamilies, fontWeights, letterSpacings } from './constants'

import styles from '../RightPanel.module.scss'
import { useArtworkDetails } from '../useArtworkDetails'
import { useArtworkHandlers } from '../useArtworkHandlers'

const ArtText = () => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const {
    handleTextAlign,
    handleColorSelect,
    handleTextFontSizeSelect,
    handleTextLineHeightSelect,
    handleTextFontWeightSelect,
    handleTextFontFamilySelect,
    handleTextLetterSpacingSelect,
  } = useArtworkHandlers(currentArtworkId)

  const { artisticTextStyles } = useArtworkDetails(currentArtworkId)

  const color = artisticTextStyles?.color ?? '#000000'

  return (
    <div className={styles.section}>
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
        <div className={styles.row}>
          <div className={styles.item}>
            <span className={styles.label}>Font size</span>
            <Select
              options={fontSizes}
              onSelect={handleTextFontSizeSelect}
              selectedLabel={artisticTextStyles?.fontSize || 16}
            />
          </div>

          <div className={styles.item}>
            <span className={styles.label}>Line height</span>
            <Select
              options={lineHeights}
              onSelect={handleTextLineHeightSelect}
              selectedLabel={artisticTextStyles?.lineHeight || 1}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <span className={styles.label}>Font Weight</span>
            <Select
              options={fontWeights}
              onSelect={handleTextFontWeightSelect}
              selectedLabel={artisticTextStyles?.fontWeight || 'Regular'}
            />
          </div>
          <div className={styles.item}>
            <span className={styles.label}>Letter Spacing</span>
            <Select
              options={letterSpacings}
              onSelect={handleTextLetterSpacingSelect}
              selectedLabel={artisticTextStyles?.letterSpacing || 1}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <span className={styles.label}>Font Family</span>
            <Select
              options={fontFamilies}
              onSelect={handleTextFontFamilySelect}
              selectedLabel={artisticTextStyles?.fontFamily || 'Roboto'}
            />
          </div>
        </div>
      </div>
      <div className={styles.subsection}>
        <div className={styles.row}>
          <div className={styles.item}>
            <span className={styles.label}>Color</span>
            <ColorPicker textColor={color} onColorSelect={handleColorSelect} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArtText
