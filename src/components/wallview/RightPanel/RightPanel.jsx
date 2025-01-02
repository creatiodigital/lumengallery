import { useGLTF } from '@react-three/drei'
import React from 'react'
import { useSelector } from 'react-redux'

import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { ButtonIcon } from '@/components/ui/ButtonIcon'

import { ArtText } from './ArtText'
import { Paint } from './Paint'
import styles from './RightPanel.module.scss'
import { useArtworkDetails } from './useArtworkDetails'
import { useArtworkHandlers } from './useArtworkHandlers'

const RightPanel = () => {
  const { nodes } = useGLTF('/assets/one-space40.glb')
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const boundingData = useBoundingData(nodes, currentWallId)

  const { width, height, x, y, name, artworkType } = useArtworkDetails(currentArtworkId)
  const wallWidth = useSelector((state) => state.wallView.wallWidth)
  const wallHeight = useSelector((state) => state.wallView.wallHeight)

  const {
    handleWidthChange,
    handleHeightChange,
    handleNameChange,
    handleMoveXChange,
    handleMoveYChange,
    handleAlignChange,
  } = useArtworkHandlers(currentArtworkId, boundingData)

  const handleAlign = (alignment) => {
    handleAlignChange(alignment, wallWidth, wallHeight, boundingData)
  }

  return (
    <div className={styles.panel}>
      {isWizardOpen && (
        <div>
          {artworkType !== '' && (
            <div className={styles.properties}>
              <div className={styles.section}>
                <div className={styles.subsection}>
                  <div className={styles.row}>
                    <div className={styles.item}>
                      <span className={styles.label}>Title</span>
                      <Input value={name} onChange={handleNameChange} />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.section}>
                <div className={styles.subsection}>
                  <div className={styles.row}>
                    <div className={styles.item}>
                      <ButtonIcon
                        icon="horizontalLeft"
                        onClick={() => handleAlign('horizontalLeft')}
                      />
                    </div>
                    <div className={styles.item}>
                      <ButtonIcon
                        icon="horizontalCenter"
                        onClick={() => handleAlign('horizontalCenter')}
                      />
                    </div>
                    <div className={styles.item}>
                      <ButtonIcon
                        icon="horizontalRight"
                        onClick={() => handleAlign('horizontalRight')}
                      />
                    </div>
                  </div>
                  <div className={styles.row}>
                    <div className={styles.item}>
                      <ButtonIcon icon="verticalTop" onClick={() => handleAlign('verticalTop')} />
                    </div>
                    <div className={styles.item}>
                      <ButtonIcon
                        icon="verticalCenter"
                        onClick={() => handleAlign('verticalCenter')}
                      />
                    </div>
                    <div className={styles.item}>
                      <ButtonIcon
                        icon="verticalBottom"
                        onClick={() => handleAlign('verticalBottom')}
                      />
                    </div>
                  </div>
                  <div className={styles.row}>
                    <div className={styles.item}>
                      <span className={styles.label}>Width (mts)</span>
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
                      <span className={styles.label}>Height (mts)</span>
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
                  <div className={styles.row}>
                    <div className={styles.item}>
                      <span className={styles.label}>Horizontal</span>
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
                      <span className={styles.label}>Vertical</span>
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

              {artworkType === 'paint' && <Paint />}
              {artworkType === 'text' && <ArtText />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

useGLTF.preload('/assets/one-space40.glb')

export default RightPanel
