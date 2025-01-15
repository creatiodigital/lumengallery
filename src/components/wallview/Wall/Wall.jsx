import { useGLTF } from '@react-three/drei'
import Image from 'next/image'
import React, { useRef, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Artwork } from '@/components/wallview/Artwork'
import { Group } from '@/components/wallview/Group'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { useCreateArtwork } from '@/components/wallview/hooks/useCreateArtwork'
import { useDeselectArtwork } from '@/components/wallview/hooks/useDeselectArtwork'
import { useGroupArtwork } from '@/components/wallview/hooks/useGroupArtwork'
import { useKeyboardEvents } from '@/components/wallview/hooks/useKeyboardEvents'
import { useResizeArtwork } from '@/components/wallview/hooks/useResizeArtwork'
import { convert2DTo3D } from '@/components/wallview/utils'
import { edit3DCoordinates } from '@/lib/features/artistSlice'
import { setShiftKeyDown } from '@/lib/features/wallViewSlice'
import { setWallCoordinates, setWallDimensions } from '@/lib/features/wallViewSlice'

import { AlignedLine } from './AlignedLine'
import styles from './Wall.module.scss'

export const Wall = () => {
  const { nodes } = useGLTF('/assets/galleries/one-space42.glb')
  const artworks = useSelector((state) => state.artist.artworks)
  const isDragging = useSelector((state) => state.wallView.isDragging)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const scaleFactor = useSelector((state) => state.wallView.scaleFactor)
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const [wallWidth, setWallWidth] = useState('')
  const [wallHeight, setWallHeight] = useState('')
  const [hoveredArtworkId, setHoveredArtworkId] = useState(null)
  const [selectionBox, setSelectionBox] = useState(null)
  const [isSelecting, setIsSelecting] = useState(false)

  const isArtworkUploaded = useSelector((state) => state.wizard.isArtworkUploaded)
  const isPersonVisible = useSelector((state) => state.wallView.isPersonVisible)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const isDraggingGroup = useSelector((state) => state.wallView.isDraggingGroup)
  const alignedPairs = useSelector((state) => state.wallView.alignedPairs)
  const dispatch = useDispatch()
  const scaling = 100
  const personHeight = 180
  const personWidth = 70

  const wallRef = useRef(null)
  const preventClick = useRef(false)

  const currentArtwork = artworks?.find((art) => art.id === currentArtworkId)
  const boundingData = useBoundingData(nodes, currentWallId)
  const { handleCreateArtworkDrag } = useCreateArtwork(boundingData, currentWallId)

  const { handleRemoveArtworkGroup, handleAddArtworkToGroup, handleCreateArtworkGroup } =
    useGroupArtwork(wallRef, boundingData, scaleFactor, preventClick)

  const { handleResize } = useResizeArtwork(boundingData, scaleFactor, wallRef)

  useEffect(() => {
    return () => {
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

  const handleMouseDown = (e) => {
    const rect = wallRef.current.getBoundingClientRect()
    const startX = (e.clientX - rect.left) / scaleFactor
    const startY = (e.clientY - rect.top) / scaleFactor

    setSelectionBox({ startX, startY, endX: startX, endY: startY })
    setIsSelecting(true) // Start selection
  }

  const handleMouseMove = (e) => {
    if (!selectionBox) return

    const rect = wallRef.current.getBoundingClientRect()
    const endX = (e.clientX - rect.left) / scaleFactor
    const endY = (e.clientY - rect.top) / scaleFactor

    setSelectionBox((prev) => ({ ...prev, endX, endY }))
  }

  const handleMouseUp = () => {
    if (!selectionBox) return

    const { startX, startY, endX, endY } = selectionBox

    // Calculate the selection area
    const minX = Math.min(startX, endX)
    const minY = Math.min(startY, endY)
    const maxX = Math.max(startX, endX)
    const maxY = Math.max(startY, endY)

    // Determine which artworks are within the selection area
    const selectedArtworks = artworks.filter((artwork) => {
      const artX = artwork.canvas.x
      const artY = artwork.canvas.y
      const artWidth = artwork.canvas.width
      const artHeight = artwork.canvas.height

      return artX >= minX && artY >= minY && artX + artWidth <= maxX && artY + artHeight <= maxY
    })

    console.log('Selection Box Bounds:', { minX, maxX, minY, maxY })

    // Add selected artworks to the group
    selectedArtworks.forEach((artwork) => {
      console.log('Artwork:', artwork.id, {
        x: artwork.canvas.x,
        y: artwork.canvas.y,
        width: artwork.canvas.width,
        height: artwork.canvas.height,
      })

      handleAddArtworkToGroup(artwork.id)
    })

    // Clear the selection box
    setSelectionBox(null)
    setIsSelecting(false)

    preventClick.current = true

    // Reset preventClick after a brief delay
    setTimeout(() => {
      preventClick.current = false
    }, 0)
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
    console.log('artworkGroupIds updated:', artworkGroupIds)
    if (artworkGroupIds.length > 1) {
      handleCreateArtworkGroup()
    }
  }, [artworkGroupIds])

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
    if (preventClick.current) {
      preventClick.current = false // Reset the flag
      return // Ignore this click
    }

    if (!isDraggingGroup) {
      handleRemoveArtworkGroup()
      handleDeselect()
    }
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClickOnWall}
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
        {artworks
          .filter((artwork) => artwork.wallId === currentWallId)
          .map((artwork) => (
            <Artwork
              key={artwork.id}
              artwork={artwork}
              onHandleResize={handleResize}
              setHoveredArtworkId={setHoveredArtworkId}
              wallRef={wallRef}
              boundingData={boundingData}
              scaleFactor={scaleFactor}
            />
          ))}

        {artworkGroupIds.length > 1 && (
          <Group
            wallRef={wallRef}
            boundingData={boundingData}
            scaleFactor={scaleFactor}
            preventClick={preventClick}
          />
        )}
        {selectionBox && (
          <div
            className={styles.selectionBox}
            style={{
              left: `${Math.min(selectionBox.startX, selectionBox.endX) * scaleFactor}px`,
              top: `${Math.min(selectionBox.startY, selectionBox.endY) * scaleFactor}px`,
              width: `${Math.abs(selectionBox.endX - selectionBox.startX) * scaleFactor}px`,
              height: `${Math.abs(selectionBox.endY - selectionBox.startY) * scaleFactor}px`,
            }}
          ></div>
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
