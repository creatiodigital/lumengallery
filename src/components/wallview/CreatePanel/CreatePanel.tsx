import { useGLTF } from '@react-three/drei'
import React from 'react'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { Tooltip } from '@/components/ui/Tooltip'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { useCreateArtwork } from '@/components/wallview/hooks/useCreateArtwork'
import type { RootState } from '@/redux/store'

import styles from './CreatePanel.module.scss'

export const CreatePanel = () => {
  const selectedSpace = useSelector((state: RootState) => state.dashboard.selectedSpace)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const { nodes } = useGLTF(`/assets/spaces/${selectedSpace.value}.glb`)

  const boundingData = useBoundingData(nodes, currentWallId)

  const { handleCreateArtwork } = useCreateArtwork(boundingData!, currentWallId)

  const handleArtworkDragStart = (e: React.DragEvent, artworkType: string) => {
    e.dataTransfer.setData('artworkType', artworkType)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.options}>
        <Tooltip label="Click or drag to wall to create an artistic image" top={-40}>
          <ButtonIcon
            size="big"
            icon="picture"
            onClick={() => handleCreateArtwork('image')}
            draggable
            onDragStart={(e) => handleArtworkDragStart(e, 'image')}
          />
        </Tooltip>
        <Tooltip label="Click or drag to wall to create an artistic text" top={-40}>
          <ButtonIcon
            size="big"
            icon="text"
            onClick={() => handleCreateArtwork('text')}
            draggable
            onDragStart={(e) => handleArtworkDragStart(e, 'text')}
          />
        </Tooltip>
      </div>
    </div>
  )
}

export default CreatePanel
