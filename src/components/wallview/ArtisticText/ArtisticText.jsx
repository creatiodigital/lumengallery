import React, { useState, useRef } from 'react'
import { useDispatch } from 'react-redux'

import { Icon } from '@/components/ui/Icon'
import { useArtisticText } from '@/components/wallview/hooks/useArtisticText'
import { setEditingArtwork } from '@/lib/features/dashboardSlice'

import styles from './ArtisticText.module.scss'

const ArtisticText = ({ artworkId }) => {
  const contentRef = useRef(null)
  const [isEditing, setIsEditing] = useState(false)
  const dispatch = useDispatch()

  const { artisticText, textAlign, handleArtisticTextChange } = useArtisticText(artworkId)

  const handleDoubleClick = () => {
    if (!isEditing) {
      setIsEditing(true)
      dispatch(setEditingArtwork(true))

      // Programmatically focus only on the first transition to editing mode
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.focus()
        }
      }, 0)
    }
  }

  const handleBlur = () => {
    setIsEditing(false)
    dispatch(setEditingArtwork(false))
    if (contentRef.current) {
      const updatedText = contentRef.current.innerText.trim()
      handleArtisticTextChange(updatedText) // Update the text
    }
  }

  return (
    <div
      className={`${styles.text} ${isEditing ? styles.editing : ''}`}
      onDoubleClick={handleDoubleClick}
    >
      {!artisticText.trim() && !isEditing ? (
        <div className={styles.empty}>
          <Icon name="text" size={40} color={isEditing ? '#ffffff' : '#000000'} />
          <span>Enter Text</span>
        </div>
      ) : (
        <div
          ref={contentRef}
          style={{
            textAlign,
            color: 'black',
          }}
          className={`${styles.content} ${isEditing ? styles.editable : ''}`}
          contentEditable={isEditing}
          suppressContentEditableWarning={true}
          onBlur={handleBlur}
        >
          {artisticText}
        </div>
      )}
    </div>
  )
}

export default ArtisticText
