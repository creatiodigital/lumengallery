import { useGLTF } from '@react-three/drei'
import Image from 'next/image'
import React, { useRef, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { edit3DCoordinates } from '@/lib/features/artistSlice'
import { chooseCurrentArtworkId } from '@/lib/features/wallViewSlice'
import { showWizard } from '@/lib/features/wizardSlice'

import { useBoundingData } from './hooks/useBoundingData'
import { useCreateArtwork } from './hooks/useCreateArtwork'
import { useDeselectArtwork } from './hooks/useDeselectArtwork'
import { useGlobalMouseUp } from './hooks/useGlobalMouseUp'
import { useKeyboardEvents } from './hooks/useKeyboardEvents'
import { useMoveArtwork } from './hooks/useMoveArtwork'
import { useResizeArtwork } from './hooks/useResizeArtwork'
import { convert2DTo3D } from './utils'
import styles from './Wall.module.scss'
import { Artwork } from '../Artwork'

export const Wall = ({ scaleFactor }) => {
  const { nodes } = useGLTF('/assets/one-space36.glb')
  const artworks = useSelector((state) => state.artist.artworks)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const [dragging, setDragging] = useState(false)
  const [wallWidth, setWallWidth] = useState('')
  const [wallHeight, setWallHeight] = useState('')
  const [hoveredArtworkId, setHoveredArtworkId] = useState(null)

  const isArtworkUploaded = useSelector((state) => state.wizard.isArtworkUploaded)
  const isGridVisible = useSelector((state) => state.wallView.isGridVisible)
  const isPersonVisible = useSelector((state) => state.wallView.isPersonVisible)
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
      setWallWidth(boundingData.width.toFixed(2))
      setWallHeight(boundingData.height.toFixed(2))
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
    <div className={styles.wrapper}>
      <span className={styles.wallWidth}>{`${wallWidth} M`}</span>
      <span className={styles.wallHeight}>{`${wallHeight} M`}</span>
      <div
        ref={wallRef}
        className={styles.wall}
        onDoubleClick={(event) => handleCreateArtwork(event, wallRef)}
        onClick={handleDeselect}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
      >
        {isPersonVisible && (
          <div className={styles.person}>
            <Image src="/assets/person.png" alt="person" width="70" height="180" />
          </div>
        )}
        {isGridVisible && <div className={styles.grid} />}

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
    </div>
  )
}

useGLTF.preload('/assets/one-space36.glb')
