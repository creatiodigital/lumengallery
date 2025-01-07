import { useGLTF } from '@react-three/drei'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { Tooltip } from '@/components/ui/Tooltip'
import { useCreateArtwork } from '@/components/wallview/hooks/useCreateArtwork'

import styles from './CreatePanel.module.scss'

export const CreatePanel = () => {
  const { nodes } = useGLTF('/assets/one-space42.glb')
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes, currentWallId)

  const { handleCreateArtwork } = useCreateArtwork(boundingData, currentWallId)

  const handleDragStart = (e, artworkType) => {
    e.dataTransfer.setData('artworkType', artworkType)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.options}>
        <Tooltip label="Click or drag to create an image" top={-40}>
          <ButtonIcon
            size="big"
            icon="picture"
            label="Paint"
            onClick={() => handleCreateArtwork('paint')}
            draggable
            onDragStart={(e) => handleDragStart(e, 'paint')}
          />
        </Tooltip>
        <Tooltip label="Click or drag to create a text" top={-40}>
          <ButtonIcon
            size="big"
            icon="text"
            label="Text"
            onClick={() => handleCreateArtwork('text')}
            draggable
            onDragStart={(e) => handleDragStart(e, 'text')}
          />
        </Tooltip>
      </div>
    </div>
  )
}

export default CreatePanel
