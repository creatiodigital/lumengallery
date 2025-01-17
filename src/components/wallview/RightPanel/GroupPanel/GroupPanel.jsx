import { useGLTF } from '@react-three/drei'
import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { NumberInput } from '@/components/ui/NumberInput'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'

import { useAlignGroup } from '../hooks/useAlignGroup'
import { useDistributeGroup } from '../hooks/useDistributeGroup'
import { useGroupDetails } from '../hooks/useGroupDetails'
import { useGroupHandlers } from '../hooks/useGroupHandlers'
import styles from '../RightPanel.module.scss'

const GroupPanel = () => {
  const currentGallery = useSelector((state) => state.scene.currentGallery)
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)

  const { nodes } = useGLTF(currentGallery)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes, currentWallId)

  const { groupX, groupY } = useGroupDetails()

  // const wallWidth = useSelector((state) => state.wallView.wallWidth)
  // const wallHeight = useSelector((state) => state.wallView.wallHeight)

  const { handleMoveGroupXChange, handleMoveGroupYChange } = useGroupHandlers(
    artworkGroupIds,
    boundingData,
  )

  const { alignArtworksInGroup } = useAlignGroup(boundingData)
  const { distributeArtworksInGroup } = useDistributeGroup(boundingData)

  const handleAlign = (alignment) => {
    alignArtworksInGroup(alignment)
  }

  const handleDistribute = (alignment) => {
    distributeArtworksInGroup(alignment)
  }

  useEffect(() => {
    if (currentGallery) {
      useGLTF.preload(currentGallery)
    }
  }, [currentGallery])
  return (
    <>
      <div className={styles.section}>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.item}>{`${artworkGroupIds.length}`} elements</div>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <h2 className={styles.title}>Group Position</h2>
        <div className={styles.subsection}>
          <h3 className={styles.subtitle}>Position (meters)</h3>
          <div className={styles.row}>
            <div className={styles.item}>
              <NumberInput
                value={groupX / 100}
                icon="move"
                rotate={90}
                min={0}
                max={1000}
                onChange={handleMoveGroupXChange}
              />
            </div>
            <div className={styles.item}>
              <NumberInput
                value={groupY / 100}
                icon="move"
                min={0}
                max={1000}
                onChange={handleMoveGroupYChange}
              />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <h2 className={styles.title}>Elements Layout</h2>
        <div className={styles.subsection}>
          <h3 className={styles.subtitle}>Alignment</h3>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="verticalTop" onClick={() => handleAlign('verticalTop')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="verticalCenter" onClick={() => handleAlign('verticalCenter')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="verticalBottom" onClick={() => handleAlign('verticalBottom')} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="horizontalLeft" onClick={() => handleAlign('horizontalLeft')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="horizontalCenter" onClick={() => handleAlign('horizontalCenter')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="horizontalRight" onClick={() => handleAlign('horizontalRight')} />
            </div>
          </div>
        </div>
        <div className={styles.subsection}>
          <h3 className={styles.subtitle}>Distribution</h3>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon
                icon="distributeHorizontal"
                onClick={() => handleDistribute('horizontal')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="distributeVertical" onClick={() => handleDistribute('vertical')} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default GroupPanel
