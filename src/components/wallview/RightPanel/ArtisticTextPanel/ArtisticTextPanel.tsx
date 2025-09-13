import React from 'react'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Select } from '@/components/ui/Select'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkTextHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkTextHandlers'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'

import { fontSizes, lineHeights, fontFamilies, fontWeights, letterSpacings } from './constants'

const ArtisticText = () => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const { handleEditArtworkText } = useArtworkTextHandlers(currentArtworkId)

  const { textColor, fontSize, lineHeight, fontWeight, letterSpacing, fontFamily } =
    useArtworkDetails(currentArtworkId)

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Text Styles</h2>
      <div className={styles.subsection}>
        <h3 className={styles.subtitle}>Alignment</h3>
        <div className={styles.row}>
          <div className={styles.item}>
            <ButtonIcon
              icon="textLeft"
              onClick={() => handleEditArtworkText('textAlign', 'left')}
            />
          </div>
          <div className={styles.item}>
            <ButtonIcon
              icon="textCenter"
              onClick={() => handleEditArtworkText('textAlign', 'center')}
            />
          </div>
          <div className={styles.item}>
            <ButtonIcon
              icon="textRight"
              onClick={() => handleEditArtworkText('textAlign', 'right')}
            />
          </div>
        </div>
      </div>

      <div className={styles.subsection}>
        <div className={styles.row}>
          <div className={styles.item}>
            <span className={styles.label}>Font size</span>
            <Select
              options={fontSizes}
              onSelect={(value) => handleEditArtworkText('fontSize', value)}
              selectedLabel={fontSize}
            />
          </div>

          <div className={styles.item}>
            <span className={styles.label}>Line height</span>
            <Select
              options={lineHeights}
              onSelect={(value) => handleEditArtworkText('lineHeight', value)}
              selectedLabel={lineHeight}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <span className={styles.label}>Font Weight</span>
            <Select
              options={fontWeights}
              onSelect={(value) => handleEditArtworkText('fontWeight', value)}
              selectedLabel={fontWeight}
            />
          </div>
          <div className={styles.item}>
            <span className={styles.label}>Letter Spacing</span>
            <Select
              options={letterSpacings}
              onSelect={(value) => handleEditArtworkText('letterSpacing', value)}
              selectedLabel={letterSpacing}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <span className={styles.label}>Font Family</span>
            <Select
              options={fontFamilies}
              onSelect={(value) => handleEditArtworkText('fontFamily', value)}
              selectedLabel={fontFamily}
            />
          </div>
        </div>
      </div>
      <div className={styles.subsection}>
        <div className={styles.row}>
          <div className={styles.item}>
            <span className={styles.label}>Color</span>
            <ColorPicker
              textColor={textColor}
              onColorSelect={(value) => handleEditArtworkText('textColor', value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArtisticText
