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

  const {
    artisticText,
    textAlign,
    handleArtisticTextChange,
    textColor,
    fontSize,
    fontFamily,
    fontWeight,
    lineHeight,
  } = useArtisticText(artworkId)

  const fontFamilyVariable =
    {
      Roboto: 'var(--font-wall1)',
      Lora: 'var(--font-wall2)',
    }[fontFamily] || 'var(--font-wall1)'

  const fontWeightVariable =
    {
      Regular: 400,
      Bold: 600,
    }[fontWeight] || 400

  const handleDoubleClick = () => {
    if (!isEditing) {
      setIsEditing(true)
      dispatch(setEditingArtwork(true))

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
      handleArtisticTextChange(updatedText)
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
            color: textColor,
            fontFamily: fontFamilyVariable,
            fontWeight: fontWeightVariable,
            // letterSpacing: letterSpacing,
            fontSize: fontSize,
            lineHeight: lineHeight,
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
