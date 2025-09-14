import React from 'react'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Select } from '@/components/ui/Select'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkTextHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkTextHandlers'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'
import type { TFontFamily, TFontWeight } from '@/types/fonts'

import { fontSizes, lineHeights, fontFamilies, fontWeights, letterSpacings } from './constants'

const ArtisticText = () => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const { handleEditArtworkText } = useArtworkTextHandlers(currentArtworkId || '')

  const { textColor, fontSize, lineHeight, fontWeight, letterSpacing, fontFamily } =
    useArtworkDetails(currentArtworkId!)

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
            <Select<number>
              options={fontSizes}
              value={fontSize?.value}
              onChange={(val) =>
                handleEditArtworkText('fontSize', { label: String(val), value: val })
              }
            />
          </div>

          <div className={styles.item}>
            <span className={styles.label}>Line height</span>

            <Select<number>
              options={lineHeights}
              value={lineHeight?.value}
              onChange={(val) =>
                handleEditArtworkText('lineHeight', { label: String(val), value: val })
              }
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <span className={styles.label}>Font Weight</span>
            <Select<TFontWeight>
              options={fontWeights}
              value={fontWeight?.value}
              onChange={(val) => handleEditArtworkText('fontWeight', { label: val, value: val })}
            />
          </div>
          <div className={styles.item}>
            <span className={styles.label}>Letter Spacing</span>
            <Select<number>
              options={letterSpacings}
              value={letterSpacing?.value}
              onChange={(val) =>
                handleEditArtworkText('letterSpacing', { label: String(val), value: val })
              }
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <span className={styles.label}>Font Family</span>
            <Select<TFontFamily>
              options={fontFamilies}
              value={fontFamily?.value}
              onChange={(val) => handleEditArtworkText('fontFamily', { label: val, value: val })}
            />
          </div>
        </div>
      </div>
      <div className={styles.subsection}>
        <div className={styles.row}>
          <div className={styles.item}>
            <span className={styles.label}>Color</span>
            <ColorPicker
              textColor={textColor!}
              onColorSelect={(value) => handleEditArtworkText('textColor', value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArtisticText
