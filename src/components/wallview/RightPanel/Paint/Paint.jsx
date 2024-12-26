import React from 'react'
import { useSelector } from 'react-redux'

import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

import styles from '../RightPanel.module.scss'
import { useArtworkDetails } from '../useArtworkDetails'
import { useArtworkHandlers } from '../useArtworkHandlers'

const Paint = () => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { description, author } = useArtworkDetails(currentArtworkId)

  const { handleAuthorChange, handleDescriptionChange } = useArtworkHandlers(currentArtworkId)

  return (
    <div className={styles.section}>
      <div className={styles.subsection}>
        <h3 className={styles.subtitle}>Author</h3>
        <Input value={author} onChange={handleAuthorChange} />
      </div>
      <div className={styles.subsection}>
        <h3 className={styles.subtitle}>Description</h3>
        <Textarea value={description} onChange={handleDescriptionChange} />
      </div>
    </div>
  )
}

export default Paint
