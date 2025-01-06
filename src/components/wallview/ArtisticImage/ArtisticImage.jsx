import c from 'classnames'
import React, { useRef, useState } from 'react'
import { useDispatch } from 'react-redux'

import { FileInput } from '@/components/ui/FileInput'
import { Icon } from '@/components/ui/Icon'
import { editArtworkUrlImage } from '@/lib/features/artistSlice'

import styles from './ArtisticImage.module.scss'

const ArtisticImage = ({ artwork, url, artworkId }) => {
  //TODO: remove url and artworkId from props
  const fileInputRef = useRef(null)
  const dispatch = useDispatch()
  const [isDragOver, setIsDragOver] = useState(false)
  const allowedTypes = ['image/jpeg', 'image/png']

  const { frameStyles, showFrame } = artwork

  const { frameColor, frameThickness } = frameStyles

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
      className={`${styles.frame} ${isDragOver ? styles.dragOver : ''}`}
      style={{
        border: showFrame ? `${frameThickness}px solid ${frameColor}` : null,
      }}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={styles.image}
        style={{
          backgroundImage: url ? `url(${url})` : 'none',
        }}
      >
        {!url && (
          <div className={c([styles.empty, { [styles.over]: isDragOver }])}>
            <Icon name="picture" size={40} color={isDragOver ? '#ffffff' : '#000000'} />
          </div>
        )}
        <FileInput
          ref={fileInputRef}
          id={`file-upload-${artworkId}`}
          onInput={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  )
}

export default ArtisticImage
