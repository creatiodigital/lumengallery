import React from 'react'
import { useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FileInput } from '@/components/ui/FileInput'
// import { Icon } from '@/components/ui/Icon'

import { useArtworkDetails } from './useArtworkDetails'
import { useArtworkHandlers } from './useArtworkHandlers'
import { useFileUpload } from './useFileUpload'

import styles from './RightPanel.module.scss'

const RightPanel = () => {
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { width, height, x, y, name, author } = useArtworkDetails(currentArtworkId)

  const {
    handleWidthChange,
    handleHeightChange,
    handleNameChange,
    handleAuthorChange,
    handleMoveXChange,
    handleMoveYChange,
  } = useArtworkHandlers(currentArtworkId)

  const { handleFileChange, triggerFileUpload } = useFileUpload(currentArtworkId)

  return (
    <div className={styles.rightPanel}>
      Artwork Panel
      {isWizardOpen && (
        <div className={styles.wizard}>
          <div>
            <p>
              <label>Width</label>
              {/* <Icon name="expand" size={24} color="black" /> */}
              <Input value={width} onChange={handleWidthChange} />
            </p>
            <p>
              <label>Height</label>
              <Input value={height} onChange={handleHeightChange} />
            </p>
            <p>
              <label>X</label>
              <Input value={x} onChange={handleMoveXChange} />
            </p>
            <p>
              <label>Y</label>
              <Input value={y} onChange={handleMoveYChange} />
            </p>
          </div>
          <div>
            <div className={styles.cta}>
              <Button onClick={triggerFileUpload} type="small" label="Choose Image" />
              <FileInput id="file-upload" onInput={handleFileChange} />
            </div>
          </div>
          <div>
            <h2>Name</h2>
            <Input value={name} onChange={handleNameChange} />
          </div>
          <div>
            <h2>Author</h2>
            <Input value={author} onChange={handleAuthorChange} />
          </div>
        </div>
      )}
    </div>
  )
}

export default RightPanel
