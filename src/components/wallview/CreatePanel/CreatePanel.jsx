import { useGLTF } from '@react-three/drei'
import { useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { Tooltip } from '@/components/ui/Tooltip'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { useCreateArtwork } from '@/components/wallview/hooks/useCreateArtwork'

import styles from './CreatePanel.module.scss'

export const CreatePanel = () => {
  const selectedSpace = useSelector((state) => state.dashboard.selectedSpace)
  const { nodes } = useGLTF(`/assets/spaces/${selectedSpace.value}.glb`)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes, currentWallId)

  const { handleCreateArtwork } = useCreateArtwork(boundingData, currentWallId)

  const handleArtworkDragStart = (e, TArtwork) => {
    e.dataTransfer.setData('TArtwork', TArtwork)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.options}>
        <Tooltip label="Click or drag to wall to create an artistic image" top={-40}>
          <ButtonIcon
            size="big"
            icon="picture"
            label="Paint"
            onClick={() => handleCreateArtwork('image')}
            draggable
            onDragStart={(e) => handleArtworkDragStart(e, 'image')}
          />
        </Tooltip>
        <Tooltip label="Click or drag to wall to create an artistic text" top={-40}>
          <ButtonIcon
            size="big"
            icon="text"
            label="Text"
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
