import React from 'react'
import { useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { FileInput } from '@/components/ui/FileInput'
import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import { Textarea } from '@/components/ui/Textarea'

import styles from './RightPanel.module.scss'
import { useArtworkDetails } from './useArtworkDetails'
import { useArtworkHandlers } from './useArtworkHandlers'
import { useFileUpload } from './useFileUpload'

const RightPanel = () => {
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { width, height, x, y, name, description, author } = useArtworkDetails(currentArtworkId)

  const {
    handleWidthChange,
    handleHeightChange,
    handleNameChange,
    handleAuthorChange,
    handleDescriptionChange,
    handleMoveXChange,
    handleMoveYChange,
  } = useArtworkHandlers(currentArtworkId)

  const { handleFileChange, triggerFileUpload } = useFileUpload(currentArtworkId)

  return (
    <div className={styles.panel}>
      {isWizardOpen && (
        <>
          <div className={styles.section}>
            <h2 className={styles.title}>Layout</h2>
            <div className={styles.subsection}>
              <h3 className={styles.subtitle}>Size (meters)</h3>
              <div className={styles.row}>
                <div className={styles.item}>
                  <NumberInput
                    value={width / 100}
                    icon="expand"
                    rotate={90}
                    min={0.1}
                    max={10}
                    onChange={handleWidthChange}
                  />
                </div>
                <div className={styles.item}>
                  <NumberInput
                    value={height / 100}
                    icon="expand"
                    min={0.1}
                    max={10}
                    onChange={handleHeightChange}
                  />
                </div>
              </div>
            </div>
            <div className={styles.subsection}>
              <h3 className={styles.subtitle}>Position (meters)</h3>
              <div className={styles.row}>
                <div className={styles.item}>
                  <NumberInput
                    value={x / 100}
                    icon="move"
                    rotate={90}
                    min={0}
                    max={10}
                    onChange={handleMoveXChange}
                  />
                </div>
                <div className={styles.item}>
                  <NumberInput
                    value={y / 100}
                    icon="move"
                    min={0}
                    max={10}
                    onChange={handleMoveYChange}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.subsection}>
              <Button onClick={triggerFileUpload} type="small" label="Choose Image" />
              <FileInput id="file-upload" onInput={handleFileChange} />
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.title}>Meta</h2>
            <div className={styles.subsection}>
              <h3 className={styles.subtitle}>Title</h3>
              <Input value={name} onChange={handleNameChange} />
            </div>
            <div className={styles.subsection}>
              <h3 className={styles.subtitle}>Author</h3>
              <Input value={author} onChange={handleAuthorChange} />
            </div>
            <div className={styles.subsection}>
              <h3 className={styles.subtitle}>Description</h3>
              <Textarea value={description} onChange={handleDescriptionChange} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default RightPanel
