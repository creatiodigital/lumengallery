'use client'

import React, { useState, useRef } from 'react'
import { useDispatch } from 'react-redux'

import { Icon } from '@/components/ui/Icon'
import { useArtisticText } from '@/components/wallview/hooks/useArtisticText'
import { setEditingArtwork } from '@/redux/slices/dashboardSlice'

import styles from './ArtisticText.module.scss'

interface ArtisticTextProps {
  artworkId: string
}

const ArtisticText = ({ artworkId }: ArtisticTextProps) => {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const dispatch = useDispatch()

  const {
    textContent,
    textAlign,
    handleArtisticTextChange,
    textColor,
    fontSize,
    fontFamily,
    fontWeight,
    lineHeight,
  } = useArtisticText(artworkId)

  const fontFamilyMap: Record<'roboto' | 'lora', string> = {
    roboto: 'var(--font-wall1)',
    lora: 'var(--font-wall2)',
  }
  const fontWeightMap: Record<'regular' | 'bold', number> = {
    regular: 400,
    bold: 600,
  }

  const fontFamilyVariable = fontFamilyMap[fontFamily]
  const fontWeightVariable = fontWeightMap[fontWeight]

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
      {!textContent.trim() && !isEditing ? (
        <div className={styles.empty}>
          <Icon name="text" size={40} color={isEditing ? '#ffffff' : '#000000'} />
        </div>
      ) : (
        <div
          ref={contentRef}
          style={{
            textAlign,
            color: textColor,
            fontFamily: fontFamilyVariable,
            fontWeight: fontWeightVariable,
            fontSize,
            lineHeight,
          }}
          className={`${styles.content} ${isEditing ? styles.editable : ''}`}
          contentEditable={isEditing}
          suppressContentEditableWarning={true}
          onBlur={handleBlur}
        >
          {textContent}
        </div>
      )}
    </div>
  )
}

export default ArtisticText
