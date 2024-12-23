import React, { useState, useRef } from 'react'
import { useDispatch } from 'react-redux'
import styles from './ArtisticText.module.scss'
import { useArtisticText } from '@/components/wallview/hooks/useArtisticText'
import { setEditingArtwork } from '@/lib/features/dashboardSlice'

const ArtisticText = ({ artworkId }) => {
  const contentRef = useRef(null)
  const [isEditing, setIsEditing] = useState(false)
  const dispatch = useDispatch()

  const { artisticText, textAlign, handleArtisticTextChange } = useArtisticText(artworkId)

  const handleDoubleClick = () => {
    setIsEditing(true)
    dispatch(setEditingArtwork(true))
  }

  const handleBlur = () => {
    setIsEditing(false)
    dispatch(setEditingArtwork(false))
    if (contentRef.current) {
      const updatedText = contentRef.current.innerText
      handleArtisticTextChange(updatedText)
    }
  }

  return (
    <div className={styles.text}>
      <div
        ref={contentRef}
        style={{
          textAlign,
          color: 'black',
        }}
        className={`${styles.content} ${isEditing ? styles.editable : ''}`}
        contentEditable={isEditing}
        suppressContentEditableWarning={true}
        onDoubleClick={handleDoubleClick}
        onBlur={handleBlur}
      >
        {artisticText}
      </div>
    </div>
  )
}

export default ArtisticText
