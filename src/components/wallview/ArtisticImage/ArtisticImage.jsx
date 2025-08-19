import c from 'classnames'
import React, { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { FileInput } from '@/components/ui/FileInput'
import { Icon } from '@/components/ui/Icon'
import { editArtisticImage } from '@/app/redux/slices/artworksSlice'
import { chooseCurrentArtworkId } from '@/app/redux/slices/wallViewSlice'

import styles from './ArtisticImage.module.scss'

const ArtisticImage = ({ artwork }) => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const fileInputRef = useRef(null)
  const dispatch = useDispatch()
  const [isDragOver, setIsDragOver] = useState(false)
  const allowedTypes = ['image/jpeg', 'image/png']

  const { artisticImageProperties } = artwork

  const {
    showFrame,
    frameColor,
    frameThickness,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutThickness,
  } = artisticImageProperties

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

    if (currentArtworkId !== artwork.id) {
      dispatch(chooseCurrentArtworkId(artwork.id))
    }

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
    dispatch(
      editArtisticImage({ currentArtworkId: artwork.id, property: 'imageUrl', value: fileUrl }),
    )
  }

  return (
    <div
      className={`${styles.frame} ${isDragOver ? styles.dragOver : ''}`}
      style={{
        border: showFrame && imageUrl ? `${frameThickness.value}px solid ${frameColor}` : null,
      }}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={styles.passepartout}
        style={{
          border:
            showPassepartout && imageUrl
              ? `${passepartoutThickness.value}px solid ${passepartoutColor}`
              : null,
        }}
      >
        <div
          className={styles.image}
          style={{
            backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
          }}
        >
          {!imageUrl && (
            <div className={c([styles.empty, { [styles.over]: isDragOver }])}>
              <Icon name="picture" size={40} color={isDragOver ? '#ffffff' : '#000000'} />
            </div>
          )}
          <FileInput
            ref={fileInputRef}
            id={`file-upload-${currentArtworkId}`}
            onInput={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </div>
  )
}

export default ArtisticImage
