import React from 'react'
import { useSelector } from 'react-redux'

import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import { ArtText } from './ArtText'
import { Paint } from './Paint'

import styles from './RightPanel.module.scss'
import { useArtworkDetails } from './useArtworkDetails'
import { useArtworkHandlers } from './useArtworkHandlers'

const RightPanel = () => {
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { width, height, x, y, name, artworkType } = useArtworkDetails(currentArtworkId)

  const {
    handleWidthChange,
    handleHeightChange,
    handleNameChange,
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
              </div>
              {artworkType === 'paint' && <Paint />}
              {artworkType === 'text' && <ArtText />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RightPanel
