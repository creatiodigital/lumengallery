import { useGLTF } from '@react-three/drei'
import React from 'react'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { NumberInput } from '@/components/ui/NumberInput'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import type { RootState } from '@/redux/store'
import type { TAlign, TDistributeAlign } from '@/types/wizard'

import { useAlignGroup } from '../hooks/useAlignGroup'
import { useDistributeGroup } from '../hooks/useDistributeGroup'
import { useGroupDetails } from '../hooks/useGroupDetails'
import { useGroupHandlers } from '../hooks/useGroupHandlers'
import styles from '../RightPanel.module.scss'

const GroupPanel = () => {
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const selectedSpace = useSelector((state: RootState) => state.dashboard.selectedSpace)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)

  const { nodes } = useGLTF(`/assets/spaces/${selectedSpace.value}.glb`)
  const boundingData = useBoundingData(nodes, currentWallId)

  const { groupX, groupY } = useGroupDetails()

  const { handleMoveGroupXChange, handleMoveGroupYChange, alignGroupToWall } = useGroupHandlers(
    artworkGroupIds,
    boundingData!,
  )

  const { alignArtworksInGroup } = useAlignGroup(boundingData)
  const { distributeArtworksInGroup } = useDistributeGroup(boundingData)

  const handleAlignElements = (alignment: TAlign) => {
    alignArtworksInGroup(alignment)
  }

  const handleDistributeElements = (alignment: TDistributeAlign) => {
    distributeArtworksInGroup(alignment)
  }

  const handleAlignGroup = (alignment: TAlign) => {
    alignGroupToWall(alignment)
  }

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
        <h2 className={styles.title}>Group</h2>
        <div className={styles.subsection}>
          <h3 className={styles.subtitle}>Position in wall</h3>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="positionTop" onClick={() => handleAlignGroup('verticalTop')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="positionCenterV"
                onClick={() => handleAlignGroup('verticalCenter')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="positionBottom"
                onClick={() => handleAlignGroup('verticalBottom')}
              />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="positionLeft" onClick={() => handleAlignGroup('horizontalLeft')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="positionCenterH"
                onClick={() => handleAlignGroup('horizontalCenter')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="positionRight"
                onClick={() => handleAlignGroup('horizontalRight')}
              />
            </div>
          </div>
        </div>
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
        <h2 className={styles.title}>Elements</h2>
        <div className={styles.subsection}>
          <h3 className={styles.subtitle}>Align Elements</h3>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="verticalTop" onClick={() => handleAlignElements('verticalTop')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="verticalCenter"
                onClick={() => handleAlignElements('verticalCenter')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="verticalBottom"
                onClick={() => handleAlignElements('verticalBottom')}
              />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon
                icon="horizontalLeft"
                onClick={() => handleAlignElements('horizontalLeft')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="horizontalCenter"
                onClick={() => handleAlignElements('horizontalCenter')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="horizontalRight"
                onClick={() => handleAlignElements('horizontalRight')}
              />
            </div>
          </div>
        </div>
        <div className={styles.subsection}>
          <h3 className={styles.subtitle}>Distribution</h3>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon
                icon="distributeHorizontal"
                onClick={() => handleDistributeElements('horizontal')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="distributeVertical"
                onClick={() => handleDistributeElements('vertical')}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default GroupPanel
