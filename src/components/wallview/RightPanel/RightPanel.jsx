import styles from './RightPanel.module.scss'
import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  hideWizard,
  setArtworkUploadedTrue,
  setArtworkUploadedFalse,
} from '@/lib/features/wizardSlice'
import { editArtwork, editArtworkUrlImage } from '@/lib/features/artistSlice'

import { Button } from '@/components/ui/Button'

const RightPanel = () => {
  const dispatch = useDispatch()
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const artworks = useSelector((state) => state.artist.artworks)
  const currentArtworkId = useSelector(
    (state) => state.wallView.currentArtworkId,
  )
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')

  useEffect(() => {
    const currentEdited = artworks.find(
      (artwork) => artwork.id === currentArtworkId,
    )
    if (currentEdited) {
      setWidth(currentEdited.canvas.width)
      setHeight(currentEdited.canvas.height)
    }
  }, [artworks, currentArtworkId])

  const handleWidthChange = (e) => {
    const newWidth = parseFloat(e.target.value)
    setWidth(newWidth)

    const currentEdited = artworks.find(
      (artwork) => artwork.id === currentArtworkId,
    )
    if (!currentEdited) return

    const { x, width: currentWidth } = currentEdited.canvas
    const newX = x + (currentWidth - newWidth) / 2

    const newArtworkSizes = {
      ...currentEdited.canvas,
      width: newWidth,
      x: newX,
    }

    dispatch(editArtwork({ currentArtworkId, newArtworkSizes }))
  }

  const handleHeightChange = (e) => {
    const newHeight = parseFloat(e.target.value)
    setHeight(newHeight)

    const currentEdited = artworks.find(
      (artwork) => artwork.id === currentArtworkId,
    )
    if (!currentEdited) return

    const { y, height: currentHeight } = currentEdited.canvas
    const newY = y + (currentHeight - newHeight) / 2

    const newArtworkSizes = {
      ...currentEdited.canvas,
      height: newHeight,
      y: newY,
    }

    dispatch(editArtwork({ currentArtworkId, newArtworkSizes }))
  }

  const handleOnWizardDone = () => {
    dispatch(hideWizard())
    dispatch(setArtworkUploadedFalse())
  }

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file && currentArtworkId) {
      const url = URL.createObjectURL(file)
      dispatch(editArtworkUrlImage({ currentArtworkId, url }))
    }
  }

  const triggerFileUpload = () => {
    const fileInput = document.getElementById('file-upload')
    if (fileInput) {
      setTimeout(() => fileInput.click(), 0)
    } else {
      console.error('File input not found')
    }

    dispatch(setArtworkUploadedTrue())
  }

  return (
    <div className={styles.rightPanel}>
      Click on the wall to add an image
      {isWizardOpen && (
        <div className={styles.wizard}>
          <div>
            <div>Choose size of the image (meters)</div>
            <p>
              <label>Width</label>
              <input type="number" value={width} onChange={handleWidthChange} />
            </p>
            <p>
              <label>Height</label>
              <input
                type="number"
                value={height}
                onChange={handleHeightChange}
              />
            </p>
          </div>
          <div>
            <p>Upload an image (jpg, png)</p>
            <div className={styles.cta}>
              <Button
                onClick={triggerFileUpload}
                className={styles.uploadButton}
              >
                Choose File
              </Button>
              <input
                id="file-upload"
                type="file"
                accept="image/*"
                onInput={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RightPanel
