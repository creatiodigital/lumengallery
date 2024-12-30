import React from 'react'
import { useSelector } from 'react-redux'

import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

import styles from '../RightPanel.module.scss'
import { useArtworkDetails } from '../useArtworkDetails'
import { useArtworkHandlers } from '../useArtworkHandlers'

const Paint = () => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { description, author, showFrame } = useArtworkDetails(currentArtworkId)

  const { handleAuthorChange, handleDescriptionChange, handleShowFrame } =
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
        </div>
      </div>
    </>
  )
}

export default Paint
