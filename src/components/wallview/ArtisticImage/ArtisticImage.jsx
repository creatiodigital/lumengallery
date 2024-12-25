import React, { useRef, useState } from 'react'
import { useDispatch } from 'react-redux'

import { FileInput } from '@/components/ui/FileInput'
import { editArtworkUrlImage } from '@/lib/features/artistSlice'

import styles from './ArtisticImage.module.scss'

const ArtisticImage = ({ artworkId, url }) => {
  const fileInputRef = useRef(null)
  const dispatch = useDispatch()
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDoubleClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      processFile(file)
    }
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragOver(false)
    const file = event.dataTransfer.files[0]
    if (file) {
      processFile(file)
    }
  }

  const processFile = (file) => {
    const fileUrl = URL.createObjectURL(file) // Replace with actual upload logic in production
    dispatch(editArtworkUrlImage({ currentArtworkId: artworkId, url: fileUrl }))
  }

  return (
    <div
      className={`${styles.artisticImage} ${isDragOver ? styles.dragOver : ''}`}
      style={{
        backgroundImage: url ? `url(${url})` : 'none',
      }}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && <div className={styles.dropOverlay}>Drop your image here</div>}
      {/* Hidden file input */}
      <FileInput
        ref={fileInputRef}
        id={`file-upload-${artworkId}`}
        onInput={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default ArtisticImage
