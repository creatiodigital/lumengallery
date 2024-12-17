import styles from './Wall.module.scss'

import { useGLTF } from '@react-three/drei'
import React, { useRef, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { edit3DCoordinates } from '@/lib/features/artistSlice'
import { chooseCurrentArtworkId } from '@/lib/features/wallViewSlice'
import { showWizard } from '@/lib/features/wizardSlice'

import { useBoundingData } from './useBoundingData'
import { useCreateArtwork } from './useCreateArtwork'
import { useDeselectArtwork } from './useDeselectArtwork'
import { useGlobalMouseUp } from './useGlobalMouseUp'
import { useKeyboardEvents } from './useKeyboardEvents'
import { useMoveArtwork } from './useMoveArtwork'
import { useResizeArtwork } from './useResizeArtwork'
import { convert2DTo3D } from './utils'
import { Artwork } from '../Artwork'

export const Wall = ({ scaleFactor }) => {
  const { nodes } = useGLTF('/assets/one-space1.glb')
  const artworks = useSelector((state) => state.artist.artworks)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const [dragging, setDragging] = useState(false)
  const [hoveredArtworkId, setHoveredArtworkId] = useState(null)

  const isArtworkUploaded = useSelector((state) => state.wizard.isArtworkUploaded)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const dispatch = useDispatch()

  const wallRef = useRef(null)

  const currentArtwork = artworks.find((art) => art.id === currentArtworkId)
  const boundingData = useBoundingData(nodes, currentWallId)

  const { handleDragStart, handleDragMove, handleDragEnd } = useMoveArtwork(
    wallRef,
    boundingData,
    scaleFactor,
  )

  const { handleResize } = useResizeArtwork(boundingData, scaleFactor)

  const { handleCreateArtwork } = useCreateArtwork(boundingData, scaleFactor, currentWallId)

  const handleArtworkClick = (event, artworkId) => {
    event.stopPropagation()

    dispatch(chooseCurrentArtworkId(artworkId))

    if (!isWizardOpen) {
      dispatch(showWizard())
    }
  }

  useEffect(() => {
    if (boundingData && wallRef.current) {
      wallRef.current.style.width = `${boundingData.width * 100}px`
      wallRef.current.style.height = `${boundingData.height * 100}px`
    }
  }, [boundingData])

  useEffect(() => {
    if (boundingData) {
      const new3DCoordinate = convert2DTo3D(
        {
          x: currentArtwork.canvas.x,
          y: currentArtwork.canvas.y,
          size: {
            w: currentArtwork.canvas.width,
            h: currentArtwork.canvas.height,
          },
        },
        boundingData,
      )

      dispatch(
        edit3DCoordinates({
          currentArtworkId,
          serialized3DCoordinate: new3DCoordinate,
        }),
      )
    }
  }, [isArtworkUploaded])

  useGlobalMouseUp(dragging, setDragging)

  const handleDeselect = useDeselectArtwork()

  useKeyboardEvents(currentArtworkId, hoveredArtworkId === currentArtworkId)

  return (
    <div
      ref={wallRef}
      className={styles.wall}
      onDoubleClick={(event) => handleCreateArtwork(event, wallRef)}
      onClick={handleDeselect}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
    >
      {artworks
        .filter((artwork) => artwork.wallId === currentWallId)
        .map((artwork) => (
          <Artwork
            key={artwork.id}
            artwork={artwork}
            onArtworkClick={handleArtworkClick}
            onDragStart={handleDragStart}
            onHandleResize={handleResize}
            setHoveredArtworkId={setHoveredArtworkId}
          />
        ))}
    </div>
  )
}

useGLTF.preload('/assets/one-space1.glb')
