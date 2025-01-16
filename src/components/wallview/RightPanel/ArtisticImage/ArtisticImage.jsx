import React from 'react'
import { useSelector } from 'react-redux'

import { Checkbox } from '@/components/ui/Checkbox'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkImageHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkImageHandlers'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'

import { frameThicknessOptions } from './constants'

const ArtisticImage = () => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const {
    artworkTitle,
    description,
    author,
    artworkYear,
    artworkDimensions,
    showArtworkInformation,
    showFrame,
    frameStyles,
  } = useArtworkDetails(currentArtworkId)
  const { frameColor, frameThickness } = frameStyles

  const {
    handleAuthorChange,
    handleArtworkTitleChange,
    handleArtworkYearChange,
    handleDescriptionChange,
    handleArtworkDimensionsChange,
    handleShowFrame,
    handleShowInformation,
    handleFrameColorSelect,
    handleFrameThicknessSelect,
  } = useArtworkImageHandlers(currentArtworkId)

  return (
    <>
      <div className={styles.subsection}>
        <div className={styles.row}>
          <div className={styles.item}>
            <Checkbox
              checked={showArtworkInformation}
              onChange={(e) => handleShowInformation(e.target.checked)}
              label="Show Information"
            />
          </div>
        </div>
      </div>
      {showArtworkInformation && (
        <>
          <div className={styles.section}>
            <h2 className={styles.title}>Information</h2>
            <div className={styles.subsection}>
              <div className={styles.row}>
                <div className={styles.item}>
                  <span className={styles.label}>Author</span>
                  <Input value={author} onChange={handleAuthorChange} />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.item}>
                  <span className={styles.label}>Title</span>
                  <Input value={artworkTitle} onChange={handleArtworkTitleChange} />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.item}>
                  <span className={styles.label}>Year</span>
                  <Input value={artworkYear} onChange={handleArtworkYearChange} />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.item}>
                  <span className={styles.label}>Description</span>
                  <Textarea value={description} onChange={handleDescriptionChange} />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.item}>
                  <span className={styles.label}>Dimensions</span>
                  <Input value={artworkDimensions} onChange={handleArtworkDimensionsChange} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <div className={styles.section}>
        <h2 className={styles.title}>Features</h2>
      </div>
      <div className={styles.subsection}>
        <div className={styles.row}>
          <div className={styles.item}>
            <Checkbox
              checked={showFrame}
              onChange={(e) => handleShowFrame(e.target.checked)}
              label="Add Frame"
            />
          </div>
        </div>
      </div>
      <div className={styles.subsection}>
        {showFrame && (
          <div className={styles.row}>
            <div className={styles.item}>
              <span className={styles.label}>Frame Color</span>
              <ColorPicker textColor={frameColor} onColorSelect={handleFrameColorSelect} />
            </div>
            <div className={styles.item}>
              <span className={styles.label}>Frame Thickness</span>
              <Select
                options={frameThicknessOptions}
                onSelect={handleFrameThicknessSelect}
                selectedLabel={frameThickness}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default ArtisticImage
