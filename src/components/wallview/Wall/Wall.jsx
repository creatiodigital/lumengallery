import { useGLTF } from '@react-three/drei'
import Image from 'next/image'
import React, { useRef, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Artwork } from '@/components/wallview/Artwork'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { useCreateArtwork } from '@/components/wallview/hooks/useCreateArtwork'
import { useDeselectArtwork } from '@/components/wallview/hooks/useDeselectArtwork'
import { useGroupArtwork } from '@/components/wallview/hooks/useGroupArtwork'
import { useKeyboardEvents } from '@/components/wallview/hooks/useKeyboardEvents'
import { useMoveArtwork } from '@/components/wallview/hooks/useMoveArtwork'
import { useResizeArtwork } from '@/components/wallview/hooks/useResizeArtwork'
import { convert2DTo3D } from '@/components/wallview/utils'
import { edit3DCoordinates } from '@/lib/features/artistSlice'
import { setShiftKeyDown } from '@/lib/features/wallViewSlice'
import {
  chooseCurrentArtworkId,
  setWallCoordinates,
  setWallDimensions,
} from '@/lib/features/wallViewSlice'
import { showWizard } from '@/lib/features/wizardSlice'

import { AlignedLine } from './AlignedLine'
import styles from './Wall.module.scss'

export const Wall = () => {
  const { nodes } = useGLTF('/assets/galleries/one-space42.glb')
  const artworks = useSelector((state) => state.artist.artworks)
  const isDragging = useSelector((state) => state.wallView.isDragging)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const scaleFactor = useSelector((state) => state.wallView.scaleFactor)
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const isShiftKeyDown = useSelector((state) => state.wallView.isShiftKeyDown)
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const [wallWidth, setWallWidth] = useState('')
  const [wallHeight, setWallHeight] = useState('')
  const [hoveredArtworkId, setHoveredArtworkId] = useState(null)

  const isArtworkUploaded = useSelector((state) => state.wizard.isArtworkUploaded)
  const isGridVisible = useSelector((state) => state.wallView.isGridVisible)
  const isPersonVisible = useSelector((state) => state.wallView.isPersonVisible)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const alignedPairs = useSelector((state) => state.wallView.alignedPairs)
  const dispatch = useDispatch()
  const scaling = 100
  const personHeight = 180
  const personWidth = 70

  const wallRef = useRef(null)

  const currentArtwork = artworks?.find((art) => art.id === currentArtworkId)
  const boundingData = useBoundingData(nodes, currentWallId)
  const { handleCreateArtworkDrag } = useCreateArtwork(boundingData, currentWallId)

  const { handleDragStart, handleDragMove, handleDragEnd } = useMoveArtwork(
    wallRef,
    boundingData,
    scaleFactor,
  )

  const { handleAddArtworkToGroup, handleRemoveArtworkGroup, handleGroupDragStart } =
    useGroupArtwork()

  const { handleResize } = useResizeArtwork(boundingData, scaleFactor, wallRef)

  const handleArtworkClick = (event, artworkId) => {
    event.stopPropagation()

    if (isShiftKeyDown) {
      handleAddArtworkToGroup(artworkId)
    }

    if (!isShiftKeyDown) {
      dispatch(chooseCurrentArtworkId(artworkId))
      if (artworkGroupIds.length === 0) {
        handleAddArtworkToGroup(artworkId)
      }
    }

    if (!isWizardOpen) {
      dispatch(showWizard())
    }
  }

  useEffect(() => {
    const handleShiftDown = (e) => {
      if (e.key === 'Shift') {
        dispatch(setShiftKeyDown(true))
      }
    }

    const handleShiftUp = (e) => {
      if (e.key === 'Shift') {
        dispatch(setShiftKeyDown(false))
      }
    }

    window.addEventListener('keydown', handleShiftDown)
    window.addEventListener('keyup', handleShiftUp)

    return () => {
      document.removeEventListener('keydown', handleShiftDown)
      document.removeEventListener('keydown', handleShiftUp)
      dispatch(setShiftKeyDown(false))
    }
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    const artworkType = e.dataTransfer.getData('artworkType')

    if (artworkType && wallRef.current && boundingData) {
      const rect = wallRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * boundingData.width * scaling
      const y = ((e.clientY - rect.top) / rect.height) * boundingData.height * scaling

      handleCreateArtworkDrag(artworkType, x, y)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  useEffect(() => {
    if (boundingData && wallRef.current) {
      const width = boundingData.width
      const height = boundingData.height

      wallRef.current.style.width = `${width * scaling}px`
      wallRef.current.style.height = `${height * scaling}px`

      setWallWidth(width.toFixed(2))
      setWallHeight(height.toFixed(2))

      const { boundingBox, normal } = boundingData
      const { min, max } = boundingBox

      const x = (min.x + max.x) / 2
      const y = (min.y + max.y) / 2
      const z = (min.z + max.z) / 2

      const wallCoordinates = { x, y, z }
      const wallNormal = { x: normal.x, y: normal.y, z: normal.z }

      dispatch(setWallDimensions({ width, height }))

      dispatch(setWallCoordinates({ coordinates: wallCoordinates, normal: wallNormal }))
    }
  }, [boundingData, dispatch])

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
  }, [isArtworkUploaded, dispatch])

  const { handleDeselect } = useDeselectArtwork()

  const handleClickOnWall = () => {
    handleDeselect()
    handleRemoveArtworkGroup()
  }

  useKeyboardEvents(currentArtworkId, hoveredArtworkId === currentArtworkId)

  return (
    <div className={styles.wrapper}>
      {wallWidth && wallHeight && (
        <>
          <span className={styles.wallWidth}>{`${wallWidth} M`}</span>
          <span className={styles.wallHeight}>{`${wallHeight} M`}</span>
        </>
      )}
      <div
        ref={wallRef}
        className={styles.wall}
        onClick={handleClickOnWall}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isPersonVisible && (
          <div className={styles.person}>
            <Image
              src="/assets/person.png"
              alt="person"
              width={personWidth}
              height={personHeight}
            />
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

        {artworkGroupIds.length > 1 && (
          <div
            className={styles.group}
            style={{
              height: artworkGroup.groupHeight,
              width: artworkGroup.groupWidth,
              top: artworkGroup.groupY,
              left: artworkGroup.groupX,
            }}
            onMouseDown={(event) => handleGroupDragStart(event)}
          />
        )}
        {alignedPairs?.map((pair, index) => {
          if (!isDragging) return null
          const from = artworks?.find((art) => art.id === pair.from)?.canvas || {}
          const to = artworks?.find((art) => art.id === pair.to)?.canvas || {}

          return (
            <AlignedLine
              key={index}
              start={{
                x: from.x,
                y: from.y,
                width: from.width,
                height: from.height,
              }}
              end={{
                x: to.x,
                y: to.y,
                width: to.width,
                height: to.height,
              }}
              direction={pair.direction}
            />
          )
        })}
      </div>
    </div>
  )
}

useGLTF.preload('/assets/galleries/one-space42.glb')
