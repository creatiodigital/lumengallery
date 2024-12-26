import React, { useRef, useState } from 'react'
import c from 'classnames'
import { useDispatch } from 'react-redux'
import { Icon } from '@/components/ui/Icon'
import { FileInput } from '@/components/ui/FileInput'
import { editArtworkUrlImage } from '@/lib/features/artistSlice'
import styles from './ArtisticImage.module.scss'

const ArtisticImage = ({ artworkId, url }) => {
  const fileInputRef = useRef(null)
  const dispatch = useDispatch()
  const [isDragOver, setIsDragOver] = useState(false)
  const allowedTypes = ['image/jpeg', 'image/png']

  const handleDoubleClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file && validateFile(file)) {
      processFile(file)
    } else {
      alert('Only JPG or PNG files are allowed!')
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
    if (file && validateFile(file)) {
      processFile(file)
    } else {
      console.log('Only JPG or PNG files are allowed!')
    }
  }

  const validateFile = (file) => {
    return allowedTypes.includes(file.type)
  }

  const processFile = (file) => {
    const fileUrl = URL.createObjectURL(file)
    dispatch(editArtworkUrlImage({ currentArtworkId: artworkId, url: fileUrl }))
  }

  return (
    <div
      className={`${styles.image} ${isDragOver ? styles.dragOver : ''}`}
      style={{
        backgroundImage: url ? `url(${url})` : 'none',
      }}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {!url && (
        <div className={c([styles.empty, { [styles.over]: isDragOver }])}>
          <Icon name="picture" size={40} color={isDragOver ? '#ffffff' : '#000000'} />
          <span>Drop image</span>
        </div>
      )}
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
