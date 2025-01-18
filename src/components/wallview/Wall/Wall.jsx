import { useGLTF } from '@react-three/drei'
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Artwork } from '@/components/wallview/Artwork'
import { Group } from '@/components/wallview/Group'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { useCreateArtwork } from '@/components/wallview/hooks/useCreateArtwork'
import { useDeselectArtwork } from '@/components/wallview/hooks/useDeselectArtwork'
import { useGroupArtwork } from '@/components/wallview/hooks/useGroupArtwork'
import { useKeyboardEvents } from '@/components/wallview/hooks/useKeyboardEvents'
import { useResizeArtwork } from '@/components/wallview/hooks/useResizeArtwork'
import { useSelectBox } from '@/components/wallview/hooks/useSelectBox'
import { Human } from '@/components/wallview/Human'
import { SelectionBox } from '@/components/wallview/SelectionBox'
import { convert2DTo3D } from '@/components/wallview/utils'
import { edit3DCoordinates } from '@/lib/features/artistSlice'
import { setShiftKeyDown } from '@/lib/features/wallViewSlice'
import { setWallCoordinates, setWallDimensions } from '@/lib/features/wallViewSlice'

import { Measurements } from '../Measurements'
import { AlignedLine } from './AlignedLine'
import styles from './Wall.module.scss'

export const Wall = () => {
  const currentGallery = useSelector((state) => state.scene.currentGallery)
  const { nodes } = useGLTF(currentGallery)
  const artworks = useSelector((state) => state.artist.artworks)

  const isDragging = useSelector((state) => state.wallView.isDragging)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const scaleFactor = useSelector((state) => state.wallView.scaleFactor)
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const [wallWidth, setWallWidth] = useState('')
  const [wallHeight, setWallHeight] = useState('')
  const [hoveredArtworkId, setHoveredArtworkId] = useState(null)

  const isArtworkUploaded = useSelector((state) => state.wizard.isArtworkUploaded)
  const isHumanVisible = useSelector((state) => state.wallView.isHumanVisible)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const alignedPairs = useSelector((state) => state.wallView.alignedPairs)
  const dispatch = useDispatch()
  const scaling = 100
  const humanHeight = 180
  const humanWidth = 70

  const wallRef = useRef(null)
  const preventClick = useRef(false)

  const currentArtwork = useMemo(
    () => artworks?.find((art) => art.id === currentArtworkId),
    [artworks, currentArtworkId],
  )
  const boundingData = useBoundingData(nodes, currentWallId)
  const { handleCreateArtworkDrag } = useCreateArtwork(boundingData, currentWallId)

  const groupArtworkHandlers = useGroupArtwork(wallRef, boundingData, scaleFactor, preventClick)

  const { handleRemoveArtworkGroup } = groupArtworkHandlers

  const { handleSelectMouseDown, handleSelectMouseMove, handleSelectMouseUp, selectionBox } =
    useSelectBox(wallRef, boundingData, scaleFactor, preventClick)

  const { handleResize } = useResizeArtwork(boundingData, scaleFactor, wallRef)

  useEffect(() => {
    if (currentGallery) {
      useGLTF.preload(currentGallery)
    }
  }, [currentGallery])

  useEffect(() => {
    return () => {
      dispatch(setShiftKeyDown(false))
    }
  }, [])

  const handleDropArtworkOnWall = useCallback(
    (e) => {
      e.preventDefault()
      const artworkType = e.dataTransfer.getData('artworkType')

      if (artworkType && wallRef.current && boundingData) {
        const rect = wallRef.current.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * boundingData.width * scaling
        const y = ((e.clientY - rect.top) / rect.height) * boundingData.height * scaling

        handleCreateArtworkDrag(artworkType, x, y)
      }
    },
    [wallRef, boundingData, scaling, handleCreateArtworkDrag], // Include dependencies
  )

  const handleDragArtworkOverWall = useCallback((e) => {
    e.preventDefault()
  }, [])

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

  const handleClickOnWall = useCallback(() => {
    if (preventClick.current) return

    if (!preventClick.current) {
      handleRemoveArtworkGroup()
    }

    handleDeselect()
  }, [preventClick, handleRemoveArtworkGroup, handleDeselect])

  useKeyboardEvents(currentArtworkId, hoveredArtworkId === currentArtworkId)

  return (
    <div className={styles.wrapper}>
      {wallWidth && wallHeight && <Measurements width={wallWidth} height={wallHeight} />}
      <div
        ref={wallRef}
        className={styles.wall}
        onMouseDown={handleSelectMouseDown}
        onMouseMove={handleSelectMouseMove}
        onMouseUp={handleSelectMouseUp}
        onClick={handleClickOnWall}
        onDragOver={handleDragArtworkOverWall}
        onDrop={handleDropArtworkOnWall}
      >
        {isHumanVisible && <Human humanWidth={humanWidth} humanHeight={humanHeight} />}
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
              preventClick={preventClick}
              groupArtworkHandlers={groupArtworkHandlers}
            />
          ))}

        {artworkGroupIds.length > 1 && (
          <Group
            wallRef={wallRef}
            boundingData={boundingData}
            scaleFactor={scaleFactor}
            preventClick={preventClick}
            groupArtworkHandlers={groupArtworkHandlers}
          />
        )}
        {selectionBox && <SelectionBox selectionBox={selectionBox} scaleFactor={scaleFactor} />}
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
