'use client'

import { useGLTF } from '@react-three/drei'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Mesh } from 'three'

import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { useCreateArtwork } from '@/components/wallview/hooks/useCreateArtwork'
import { useAddExistingArtwork } from '@/components/wallview/hooks/useAddExistingArtwork'
import { MediaLibrary } from '@/components/wallview/MediaLibrary'
import type { RootState } from '@/redux/store'

import styles from './CreatePanel.module.scss'

export const CreatePanel = () => {
  const [showMediaLibrary, setShowMediaLibrary] = useState(false)

  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const gltfPath = getSpaceConfig(spaceId || 'paris').gltfPath
  const { nodes } = useGLTF(gltfPath) as unknown as {
    nodes: Record<string, Mesh>
  }

  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  const { handleCreateArtwork } = useCreateArtwork(boundingData!)
  const { handleAddExistingArtwork, duplicateError, clearDuplicateError } =
    useAddExistingArtwork(boundingData)

  const handleArtworkDragStart = (e: React.DragEvent, artworkType: string) => {
    e.dataTransfer.setData('artworkType', artworkType)
  }

  const handleClickExistingArtwork = (artwork: {
    id: string
    name: string
    artworkType: string
  }) => {
    handleAddExistingArtwork(artwork.id)
  }

  return (
    <>
      {showMediaLibrary && (
        <MediaLibrary
          onClose={() => {
            clearDuplicateError()
            setShowMediaLibrary(false)
          }}
          onClickArtwork={handleClickExistingArtwork}
          duplicateError={duplicateError}
        />
      )}
      <div className={styles.panel}>
        <div className={styles.options}>
          <Tooltip label="Add artwork from your library" placement="top" offset={16}>
            <Button
              size="big"
              icon="gallery"
              variant="secondary"
              onClick={() => setShowMediaLibrary(!showMediaLibrary)}
            />
          </Tooltip>
          <Tooltip
            label="Click to create image in the middle of the wall, or drag and drop anywhere on the wall"
            placement="top"
            offset={16}
          >
            <Button
              size="big"
              icon="image"
              variant="secondary"
              onClick={() => handleCreateArtwork('image')}
              draggable
              onDragStart={(e) => handleArtworkDragStart(e, 'image')}
            />
          </Tooltip>
          <Tooltip
            label="Click to create text in the middle of the wall, or drag and drop anywhere on the wall"
            placement="top"
            offset={16}
          >
            <Button
              size="big"
              icon="type"
              variant="secondary"
              onClick={() => handleCreateArtwork('text')}
              draggable
              onDragStart={(e) => handleArtworkDragStart(e, 'text')}
            />
          </Tooltip>
          <Tooltip
            label="Click to create video in the middle of the wall, or drag and drop anywhere on the wall"
            placement="top"
            offset={16}
          >
            <Button
              size="big"
              icon="video"
              variant="secondary"
              onClick={() => handleCreateArtwork('video')}
              draggable
              onDragStart={(e) => handleArtworkDragStart(e, 'video')}
            />
          </Tooltip>
          <Tooltip
            label="Click to create sound in the middle of the wall, or drag and drop anywhere on the wall"
            placement="top"
            offset={16}
          >
            <Button
              size="big"
              icon="volume-2"
              variant="secondary"
              onClick={() => handleCreateArtwork('sound')}
              draggable
              onDragStart={(e) => handleArtworkDragStart(e, 'sound')}
            />
          </Tooltip>
          <Tooltip
            label="Click to create a decorative shape, or drag and drop anywhere on the wall"
            placement="top"
            offset={16}
          >
            <Button
              size="big"
              icon="shapes"
              variant="secondary"
              onClick={() => handleCreateArtwork('shape')}
              draggable
              onDragStart={(e) => handleArtworkDragStart(e, 'shape')}
            />
          </Tooltip>
        </div>
      </div>
    </>
  )
}

export default CreatePanel
