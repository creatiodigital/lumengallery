import { useGLTF } from '@react-three/drei'
import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { useSelector } from 'react-redux'

import { useCreateArtwork } from '@/components/wallview/hooks/useCreateArtwork'

import styles from './CreatePanel.module.scss'

export const CreatePanel = () => {
  const { nodes } = useGLTF('/assets/one-space36.glb')
  const scaleFactor = useSelector((state) => state.wallView.scaleFactor)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes, currentWallId)

  const { handleCreateArtwork } = useCreateArtwork(boundingData, scaleFactor, currentWallId)

  return (
    <div className={styles.panel}>
      <div className={styles.options}>
        <ButtonIcon
          size="big"
          icon="painting"
          label="Paint"
          onClick={() => handleCreateArtwork('paint')}
        />
        <ButtonIcon
          size="big"
          icon="text"
          label="Text"
          onClick={() => handleCreateArtwork('text')}
        />
      </div>
    </div>
  )
}

export default CreatePanel
