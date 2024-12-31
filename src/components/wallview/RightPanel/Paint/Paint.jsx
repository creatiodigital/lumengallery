import React from 'react'
import { useSelector } from 'react-redux'

import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

import styles from '../RightPanel.module.scss'
import { useArtworkDetails } from '../useArtworkDetails'
import { useArtworkHandlers } from '../useArtworkHandlers'
import { ColorPicker } from '@/components/ui/ColorPicker'

const Paint = () => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { description, author, showFrame, frameStyles } = useArtworkDetails(currentArtworkId)
  const { frameColor } = frameStyles

  const { handleAuthorChange, handleDescriptionChange, handleShowFrame, handleFrameColorSelect } =
    useArtworkHandlers(currentArtworkId)

  return (
    <>
      <div className={styles.section}>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.item}>
              <span className={styles.label}>Author</span>
              <Input value={author} onChange={handleAuthorChange} />
            </div>
          </div>
        </div>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.item}>
              <span className={styles.label}>Description</span>
              <Textarea value={description} onChange={handleDescriptionChange} />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
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
          {showFrame && (
            <div className={styles.row}>
              <div className={styles.item}>
                <span className={styles.label}>Frame Color</span>
                <ColorPicker textColor={frameColor} onColorSelect={handleFrameColorSelect} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default Paint
