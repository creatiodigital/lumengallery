import { useGLTF } from '@react-three/drei'
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import type { DragEvent } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Mesh } from 'three'

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
import { updateArtworkPosition } from '@/redux/slices/exhibitionSlice'
import { setShiftKeyDown } from '@/redux/slices/wallViewSlice'
import { setWallCoordinates, setWallDimensions } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import { toRuntimeArtwork } from '@/utils/artworkTransform'

import { Measurements } from '../Measurements'
import { AlignedLine } from './AlignedLine'
import styles from './Wall.module.scss'

export const Wall = () => {
  const selectedSpace = useSelector((state: RootState) => state.dashboard.selectedSpace)
  const { nodes } = useGLTF(`/assets/spaces/${selectedSpace.value}.glb`)

  const allIds = useSelector((state: RootState) => state.artworks.allIds)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  const isDragging = useSelector((state: RootState) => state.wallView.isDragging)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const scaleFactor = useSelector((state: RootState) => state.wallView.scaleFactor)
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const [wallWidth, setWallWidth] = useState('')
  const [wallHeight, setWallHeight] = useState('')
  const [hoveredArtworkId, setHoveredArtworkId] = useState<string | null>(null)

  const isArtworkUploaded = useSelector((state: RootState) => state.wizard.isArtworkUploaded)
  const isHumanVisible = useSelector((state: RootState) => state.wallView.isHumanVisible)
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const alignedPairs = useSelector((state: RootState) => state.wallView.alignedPairs)
  const dispatch = useDispatch()
  const scaling = 100
  const humanHeight = 180
  const humanWidth = 70

  const wallRef = useRef<HTMLDivElement>(null!)
  const preventClick = useRef(false)

  const currentArtwork = exhibitionArtworksById[currentArtworkId ?? '']

  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)
  const { handleCreateArtworkDrag } = useCreateArtwork(boundingData!, currentWallId)

  const groupArtworkHandlers = useGroupArtwork()
  const { handleRemoveArtworkGroup } = groupArtworkHandlers

  const { handleSelectMouseDown, handleSelectMouseMove, handleSelectMouseUp, selectionBox } =
    useSelectBox(wallRef, scaleFactor, preventClick)

  const { handleResize } = useResizeArtwork(boundingData, scaleFactor, wallRef)

  useEffect(() => {
    return () => {
      dispatch(setShiftKeyDown(false))
    }
  }, [dispatch])

  const handleDropArtworkOnWall = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const artworkType = e.dataTransfer.getData('artworkType')

      if (artworkType && wallRef.current && boundingData) {
        const rect = wallRef.current.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * boundingData.width * scaling
        const y = ((e.clientY - rect.top) / rect.height) * boundingData.height * scaling

        if (artworkType === 'image' || artworkType === 'text') {
          handleCreateArtworkDrag(artworkType, x, y)
        }
      }
    },
    [wallRef, boundingData, scaling, handleCreateArtworkDrag],
  )

  const handleDragArtworkOverWall = useCallback((e: DragEvent<HTMLDivElement>) => {
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
    if (boundingData && currentArtwork) {
      const new3DCoordinate = convert2DTo3D(
        currentArtwork.posX2d,
        currentArtwork.posY2d,
        currentArtwork.width2d,
        currentArtwork.height2d,
        boundingData,
      )

      dispatch(
        updateArtworkPosition({
          artworkId: currentArtworkId ?? '',
          artworkPosition: { ...new3DCoordinate },
        }),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const wallArtworks = useMemo(() => {
    if (!currentWallId) return []
    return allIds
      .map((id) => {
        const artwork = artworksById[id]
        const pos = exhibitionArtworksById[id]
        if (!artwork || !pos) return null
        if (pos.wallId !== currentWallId) return null
        return toRuntimeArtwork(artwork, pos)
      })
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
  }, [allIds, artworksById, exhibitionArtworksById, currentWallId])

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
        {wallArtworks.map((artwork) => (
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
        {alignedPairs?.map((pair, index: number) => {
          if (!isDragging) return null

          const from = exhibitionArtworksById[pair.from] || {}
          const to = exhibitionArtworksById[pair.to] || {}

          return (
            <AlignedLine
              key={index}
              start={{
                x: from.posX2d,
                y: from.posY2d,
                width: from.width2d,
                height: from.height2d,
              }}
              end={{
                x: to.posX2d,
                y: to.posY2d,
                width: to.width2d,
                height: to.height2d,
              }}
              direction={pair.direction}
            />
          )
        })}
      </div>
    </div>
  )
}
