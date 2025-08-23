import c from 'classnames'
import React, { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { FileInput } from '@/components/ui/FileInput'
import { Icon } from '@/components/ui/Icon'
import { editArtisticImage } from '@/redux/slices/artworksSlice'
import { chooseCurrentArtworkId } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TArtisticImage } from '@/types/artwork'

import styles from './ArtisticImage.module.scss'

type ArtisticImageProps = {
  artwork: TArtisticImage
}

const ArtisticImage = ({ artwork }: ArtisticImageProps) => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dispatch = useDispatch()
  const [isDragOver, setIsDragOver] = useState(false)
  const allowedTypes = ['image/jpeg', 'image/png']

  const {
    showFrame,
    frameColor,
    frameThickness,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutThickness,
  } = artwork.artisticImageProperties

  const handleDoubleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && validateFile(file)) {
      processFile(file)
    } else {
      alert('Only JPG or PNG files are allowed!')
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
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

  const validateFile = (file: File) => {
    return allowedTypes.includes(file.type)
  }

  const processFile = (file: File) => {
    const fileUrl = URL.createObjectURL(file)
    dispatch(
      editArtisticImage({
        currentArtworkId: artwork.id,
        property: 'imageUrl',
        value: fileUrl,
      }),
    )
  }

  return (
    <div
      className={`${styles.frame} ${isDragOver ? styles.dragOver : ''}`}
      style={{
        border: showFrame && imageUrl ? `${frameThickness.value}px solid ${frameColor}` : undefined,
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
              : undefined,
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
