import { useGLTF } from '@react-three/drei'
import React from 'react'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'

import { useArtworkDetails } from '../hooks/useArtworkDetails'
import { useArtworkHandlers } from '../hooks/useArtworkHandlers'
import styles from '../RightPanel.module.scss'

const ArtworkPanel = () => {
  const { nodes } = useGLTF('/assets/galleries/one-space42.glb')
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const boundingData = useBoundingData(nodes, currentWallId)

  const { width, height, x, y, name } = useArtworkDetails(currentArtworkId)
  const wallWidth = useSelector((state) => state.wallView.wallWidth)
  const wallHeight = useSelector((state) => state.wallView.wallHeight)

  const {
    handleNameChange,
    handleAlignChange,
    handleMoveXChange,
    handleMoveYChange,
    handleWidthChange,
    handleHeightChange,
  } = useArtworkHandlers(currentArtworkId, boundingData)

  const handleAlign = (alignment) => {
    handleAlignChange(alignment, wallWidth, wallHeight, boundingData)
  }

  return (
    <>
      <div className={styles.section}>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.item}>
              <span className={styles.label}>Name</span>
              <Input value={name} onChange={handleNameChange} />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <h2 className={styles.title}>Position</h2>
        <div className={styles.subsection}>
          <h3 className={styles.subtitle}>Position in wall</h3>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="positionTop" onClick={() => handleAlign('verticalTop')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="positionCenterV" onClick={() => handleAlign('verticalCenter')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="positionBottom" onClick={() => handleAlign('verticalBottom')} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="positionLeft" onClick={() => handleAlign('horizontalLeft')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="positionCenterH" onClick={() => handleAlign('horizontalCenter')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="positionRight" onClick={() => handleAlign('horizontalRight')} />
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
                max={1000}
                onChange={handleMoveXChange}
              />
            </div>
            <div className={styles.item}>
              <NumberInput
                value={y / 100}
                icon="move"
                min={0}
                max={1000}
                onChange={handleMoveYChange}
              />
            </div>
          </div>
        </div>
      </div>
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
                max={50}
                onChange={handleWidthChange}
              />
            </div>
            <div className={styles.item}>
              <NumberInput
                value={height / 100}
                icon="expand"
                min={0.1}
                max={50}
                onChange={handleHeightChange}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

useGLTF.preload('/assets/galleries/one-space42.glb')

export default ArtworkPanel
