import React, { useRef, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { showWizard } from '@/lib/features/wizardSlice'
import { createArtwork, editArtwork } from '@/lib/features/artistSlice'
import { edit3DCoordinates } from '@/lib/features/artistSlice'

import { chooseCurrentArtworkId } from '@/lib/features/wallViewSlice'
import { v4 as uuidv4 } from 'uuid'
import { useGLTF } from '@react-three/drei'
import {
  calculateAverageNormal,
  calculateDimensionsAndBasis,
  convert2DTo3D,
} from './utils'

export const Wall = ({ scaleFactor }) => {
  const { nodes } = useGLTF('/assets/one-space3.glb')
  const artworks = useSelector((state) => state.artist.artworks)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const [boundingData, setBoundingData] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [draggedArtworkId, setDraggedArtworkId] = useState(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 }) // Offset between mouse and artwork

  const isArtworkUploaded = useSelector(
    (state) => state.wizard.isArtworkUploaded,
  )
  const currentArtworkId = useSelector(
    (state) => state.wallView.currentArtworkId,
  )
  const dispatch = useDispatch()

  const wallRef = useRef(null)

  const currentArtwork = artworks.find((art) => art.id === currentArtworkId)

  const handleDragStart = (event, artworkId) => {
    const rect = wallRef.current.getBoundingClientRect()
    const artwork = artworks.find((art) => art.id === artworkId)
    if (!artwork) return

    // Adjust offset by dividing by scaleFactor
    const offsetX = (event.clientX - rect.left) / scaleFactor - artwork.canvas.x
    const offsetY = (event.clientY - rect.top) / scaleFactor - artwork.canvas.y
    setOffset({ x: offsetX, y: offsetY })

    setDragging(true)
    setDraggedArtworkId(artworkId)
  }

  const handleDragMove = (event) => {
    if (!dragging || !draggedArtworkId || !wallRef.current || !boundingData)
      return

    const rect = wallRef.current.getBoundingClientRect()

    // Calculate mouse position adjusted by scaleFactor
    const scaledMouseX = (event.clientX - rect.left) / scaleFactor
    const scaledMouseY = (event.clientY - rect.top) / scaleFactor

    // Adjust by the captured offset (already scaled)
    let x = scaledMouseX - offset.x
    let y = scaledMouseY - offset.y

    const artwork = artworks.find((art) => art.id === draggedArtworkId)
    if (!artwork) return

    const { width: artworkWidth, height: artworkHeight } = artwork.canvas

    // Clamp the position to stay within the wall boundaries
    x = Math.max(0, Math.min(x, boundingData.width * 100 - artworkWidth)) // Prevent x from going out of bounds
    y = Math.max(0, Math.min(y, boundingData.height * 100 - artworkHeight)) // Prevent y from going out of bounds

    const updatedArtwork = {
      ...artwork,
      canvas: { ...artwork.canvas, x, y },
    }

    // Dispatch 2D position update for this specific artwork
    dispatch(
      editArtwork({
        currentArtworkId: draggedArtworkId,
        newArtworkSizes: updatedArtwork.canvas,
      }),
    )

    // Recalculate 3D coordinates for this specific artwork
    const new3DCoordinate = convert2DTo3D(
      {
        x,
        y,
        size: {
          w: updatedArtwork.canvas.width,
          h: updatedArtwork.canvas.height,
        },
      },
      boundingData,
    )
    dispatch(
      edit3DCoordinates({
        currentArtworkId: draggedArtworkId,
        serialized3DCoordinate: new3DCoordinate,
      }),
    )
  }

  const handleDragEnd = () => {
    setDragging(false)
    setDraggedArtworkId(null)
  }

  useEffect(() => {
    const currentWall = Object.values(nodes).find(
      (obj) => obj.uuid === currentWallId,
    )

    if (currentWall?.geometry?.boundingBox) {
      const boundingBox = currentWall.geometry.boundingBox
      const normal = calculateAverageNormal(currentWall)
      const dimensions = calculateDimensionsAndBasis(boundingBox, normal)
      setBoundingData({ ...dimensions, boundingBox, normal })
    }
  }, [currentWallId, nodes])

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

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragging) {
        setDragging(false)
        setDraggedArtworkId(null)
      }
    }

    if (dragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [dragging])

  const handleWallClick = (event) => {
    if (isWizardOpen) return
    const rect = wallRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left - 20) / scaleFactor
    const y = (event.clientY - rect.top - 20) / scaleFactor
    const artworkId = uuidv4()

    if (boundingData) {
      dispatch(showWizard())
    }

    dispatch(chooseCurrentArtworkId(artworkId))
    dispatch(
      createArtwork({
        id: artworkId,
        wallId: currentWallId,
        canvas: {
          x,
          y,
          width: 40,
          height: 40,
        },
        imageURL: null,
      }),
    )
  }

  return (
    <div
      ref={wallRef}
      onDoubleClick={handleWallClick}
      style={{
        position: 'relative',
        border: '1px dashed #aaaaaa',
        background: 'white',
      }}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
    >
      {artworks
        .filter((artwork) => artwork.wallId === currentWallId)
        .map((artwork) => {
          return (
            <div
              key={artwork.id}
              style={{
                position: 'absolute',
                top: `${artwork.canvas.y}px`,
                left: `${artwork.canvas.x}px`,
                width: `${artwork.canvas.width}px`,
                height: `${artwork.canvas.height}px`,
                backgroundColor: 'black',
                backgroundImage: currentArtworkId
                  ? `url(${artwork.url})`
                  : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              onMouseDown={(event) => handleDragStart(event, artwork.id)}
            />
          )
        })}
    </div>
  )
}

useGLTF.preload('/assets/one-space3.glb')
