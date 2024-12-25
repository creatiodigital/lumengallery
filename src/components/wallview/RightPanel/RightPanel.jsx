import React from 'react'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import { Textarea } from '@/components/ui/Textarea'

import styles from './RightPanel.module.scss'
import { useArtworkDetails } from './useArtworkDetails'
import { useArtworkHandlers } from './useArtworkHandlers'

const RightPanel = () => {
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { width, height, x, y, name, description, author, artworkType } =
    useArtworkDetails(currentArtworkId)

  const {
    handleWidthChange,
    handleHeightChange,
    handleNameChange,
    handleAuthorChange,
    handleDescriptionChange,
    handleTextAlign,
    handleMoveXChange,
    handleMoveYChange,
  } = useArtworkHandlers(currentArtworkId)

  return (
    <div className={styles.panel}>
      {isWizardOpen && (
        <div>
          {artworkType !== '' && (
            <div className={styles.properties}>
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
                <h2 className={styles.title}>Meta</h2>
                <div className={styles.subsection}>
                  <h3 className={styles.subtitle}>Title</h3>
                  <Input value={name} onChange={handleNameChange} />
                </div>
                {artworkType === 'paint' && (
                  <>
                    <div className={styles.subsection}>
                      <h3 className={styles.subtitle}>Author</h3>
                      <Input value={author} onChange={handleAuthorChange} />
                    </div>
                    <div className={styles.subsection}>
                      <h3 className={styles.subtitle}>Description</h3>
                      <Textarea value={description} onChange={handleDescriptionChange} />
                    </div>
                  </>
                )}
              </div>

              {artworkType === 'text' && (
                <div className={styles.section}>
                  <h2 className={styles.title}>Text Styles</h2>
                  <div className={styles.subsection}>
                    <h3 className={styles.subtitle}>Text Align</h3>
                    <div className={styles.row}>
                      <div className={styles.item}>
                        <ButtonIcon icon="close" onClick={() => handleTextAlign('left')} />
                      </div>
                      <div className={styles.item}>
                        <ButtonIcon icon="close" onClick={() => handleTextAlign('center')} />
                      </div>
                      <div className={styles.item}>
                        <ButtonIcon icon="close" onClick={() => handleTextAlign('right')} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RightPanel
