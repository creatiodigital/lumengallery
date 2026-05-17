'use client'

import { useMemo } from 'react'
import { WALL_SCALE } from '@/components/wallview/constants'
import { useGLTF } from '@react-three/drei'

import { useSelector, useDispatch } from 'react-redux'
import { Mesh } from 'three'

import { Button } from '@/components/ui/Button'
import { NumberInput } from '@/components/ui/NumberInput'
import { Text } from '@/components/ui/Typography'
import { spaceConfigs, type SpaceKey } from '@/components/scene/constants'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { cmEventToMeters } from '@/components/wallview/utils'

import type { RootState } from '@/redux/store'
import { toggleArtworkLocked } from '@/redux/slices/exhibitionSlice'
import type { PresetType } from '../PresetSection/applyPresetToArtwork'
import type { TAlign, TDistributeAlign } from '@/types/wizard'

import { useAlignGroup } from '../hooks/useAlignGroup'
import { useDistributeGroup } from '../hooks/useDistributeGroup'
import { useGroupDetails } from '../hooks/useGroupDetails'
import { useGroupHandlers } from '../hooks/useGroupHandlers'
import GroupPresetApply from './GroupPresetApply'
import styles from '../RightPanel.module.scss'

const GroupPanel = () => {
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const dispatch = useDispatch()

  // Determine if ALL grouped artworks share the same type
  const uniformType = useMemo((): PresetType | null => {
    if (artworkGroupIds.length < 2) return null
    const types = artworkGroupIds.map((id) => artworksById[id]?.artworkType || 'image')
    const allSame = types.every((t) => t === types[0])
    if (!allSame) return null
    // Map artwork kinds to preset types (image/text/shape are directly supported)
    const kind = types[0] as string
    if (kind === 'image' || kind === 'text' || kind === 'shape') return kind
    // sound and video artworks use image presets (frame/support/shadow properties)
    if (kind === 'sound' || kind === 'video') return 'image'
    return null
  }, [artworkGroupIds, artworksById])

  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)

  const gltfPath =
    spaceConfigs[spaceId || 'paris']?.gltfPath || '/assets/spaces/paris/paris10.glb?v=2'
  const { nodes } = useGLTF(gltfPath) as unknown as {
    nodes: Record<string, Mesh>
  }
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  const { fromTop, fromBottom, fromLeft, fromRight } = useGroupDetails()

  const {
    handleFromLeftChange,
    handleFromRightChange,
    handleFromTopChange,
    handleFromBottomChange,
    alignGroupToWall,
  } = useGroupHandlers(artworkGroupIds, boundingData!)

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
      <Text font="dashboard" as="h1" size="lg" className={styles.panelTitle}>
        {artworkGroupIds.length} elements
      </Text>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Position in wall
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionTop"
              onClick={() => handleAlignGroup('verticalTop')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionCenterV"
              onClick={() => handleAlignGroup('verticalCenter')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionBottom"
              onClick={() => handleAlignGroup('verticalBottom')}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionLeft"
              onClick={() => handleAlignGroup('horizontalLeft')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionCenterH"
              onClick={() => handleAlignGroup('horizontalCenter')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionRight"
              onClick={() => handleAlignGroup('horizontalRight')}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Vertical position (cm)
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <NumberInput
              value={Math.round((fromTop / WALL_SCALE) * 100)}
              icon="arrowTopFromLine"
              label="from top"
              min={0}
              max={100000}
              onChange={(e) => handleFromTopChange(cmEventToMeters(e))}
            />
          </div>
          <div className={styles.item}>
            <NumberInput
              value={Math.round((fromBottom / WALL_SCALE) * 100)}
              icon="arrowBottomFromLine"
              label="from bottom"
              min={0}
              max={100000}
              onChange={(e) => handleFromBottomChange(cmEventToMeters(e))}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Horizontal position (cm)
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <NumberInput
              value={Math.round((fromLeft / WALL_SCALE) * 100)}
              icon="arrowLeftFromLine"
              label="from left"
              min={0}
              max={100000}
              onChange={(e) => handleFromLeftChange(cmEventToMeters(e))}
            />
          </div>
          <div className={styles.item}>
            <NumberInput
              value={Math.round((fromRight / WALL_SCALE) * 100)}
              icon="arrowRightFromLine"
              label="from right"
              min={0}
              max={100000}
              onChange={(e) => handleFromRightChange(cmEventToMeters(e))}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Align Elements
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="verticalTop"
              onClick={() => handleAlignElements('verticalTop')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="verticalCenter"
              onClick={() => handleAlignElements('verticalCenter')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="verticalBottom"
              onClick={() => handleAlignElements('verticalBottom')}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="horizontalLeft"
              onClick={() => handleAlignElements('horizontalLeft')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="horizontalCenter"
              onClick={() => handleAlignElements('horizontalCenter')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="horizontalRight"
              onClick={() => handleAlignElements('horizontalRight')}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Distribution
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="distributeHorizontal"
              onClick={() => handleDistributeElements('horizontal')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="distributeVertical"
              onClick={() => handleDistributeElements('vertical')}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <Button
          size="small"
          variant="secondary"
          icon="lock"
          label="Lock All"
          onClick={() => {
            artworkGroupIds.forEach((id) => {
              dispatch(toggleArtworkLocked({ artworkId: id }))
            })
          }}
        />
      </div>

      {uniformType && (
        <div className={styles.section}>
          <GroupPresetApply artworkIds={artworkGroupIds} uniformType={uniformType} />
        </div>
      )}
    </>
  )
}

export default GroupPanel
