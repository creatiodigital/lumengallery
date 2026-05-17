'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSelector, useDispatch } from 'react-redux'

import type { RootState } from '@/redux/store'
import {
  setGuides,
  updateGuidePosition,
  removeGuide,
  selectGuide,
  removeGroup,
  chooseCurrentArtworkId,
} from '@/redux/slices/wallViewSlice'
import { WALL_SCALE } from '@/components/wallview/constants'

import styles from './Guides.module.scss'

type DragState = {
  guideId: string
  startMousePx: number // screen px at drag start
  startPositionM: number // guide position in metres at drag start
}

export const Guides = () => {
  const dispatch = useDispatch()
  const guides = useSelector((state: RootState) => state.wallView.guides)
  const selectedGuideId = useSelector((state: RootState) => state.wallView.selectedGuideId)
  const isRulersVisible = useSelector((state: RootState) => state.wallView.isRulersVisible)
  const guidesLocked = useSelector((state: RootState) => state.wallView.guidesLocked)
  const scaleFactor = useSelector((state: RootState) => state.wallView.scaleFactor)
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)

  const dragRef = useRef<DragState | null>(null)
  const mousePosRef = useRef<{ x: number; y: number } | null>(null)
  const [, forceRender] = useState(0)

  // ---- Fetch guides on wall change ----
  useEffect(() => {
    if (!exhibitionId || !currentWallId) return

    const fetchGuides = async () => {
      try {
        const res = await fetch(`/api/exhibitions/${exhibitionId}/guides?wallId=${currentWallId}`)
        if (res.ok) {
          const data = await res.json()
          dispatch(
            setGuides(
              data.map(
                (g: { id: string; wallId: string; orientation: string; position: number }) => ({
                  id: g.id,
                  wallId: g.wallId,
                  orientation: g.orientation as 'horizontal' | 'vertical',
                  position: g.position,
                }),
              ),
            ),
          )
        }
      } catch (err) {
        console.error('Failed to fetch guides:', err)
      }
    }

    fetchGuides()
  }, [exhibitionId, currentWallId, dispatch])

  // ---- Delete selected guide with Delete/Backspace ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedGuideId) return
      // Don't intercept if an input is focused
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (guidesLocked) return
        e.preventDefault()
        const guideId = selectedGuideId
        dispatch(removeGuide(guideId))

        // Persist to DB
        if (exhibitionId) {
          fetch(`/api/exhibitions/${exhibitionId}/guides`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guideId }),
          }).catch(console.error)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedGuideId, exhibitionId, dispatch, guidesLocked])

  // ---- Drag-to-move ----
  const handleGuideMouseDown = useCallback(
    (e: React.MouseEvent, guideId: string, orientation: 'horizontal' | 'vertical') => {
      e.stopPropagation()
      e.preventDefault()
      if (guidesLocked) return
      dispatch(removeGroup())
      dispatch(chooseCurrentArtworkId(null))
      dispatch(selectGuide(guideId))

      const guide = guides.find((g) => g.id === guideId)
      if (!guide) return

      dragRef.current = {
        guideId,
        startMousePx: orientation === 'horizontal' ? e.clientY : e.clientX,
        startPositionM: guide.position,
      }
      forceRender((n) => n + 1) // trigger re-render for cursor
    },
    [dispatch, guides, guidesLocked],
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return

      const guide = guides.find((g) => g.id === drag.guideId)
      if (!guide) return

      const isH = guide.orientation === 'horizontal'
      const deltaPx = isH ? e.clientY - drag.startMousePx : e.clientX - drag.startMousePx

      // Convert screen delta to metres: deltaPx / (WALL_SCALE * scaleFactor)
      // For horizontal guides, positive screen delta = down = negative metres (because 0 is at bottom, up is positive)
      // For vertical guides, positive screen delta = right = positive metres
      const deltaM = deltaPx / (WALL_SCALE * scaleFactor)
      const newPosition = drag.startPositionM + (isH ? -deltaM : deltaM)

      dispatch(updateGuidePosition({ id: drag.guideId, position: newPosition }))

      // Track mouse position for the floating label
      mousePosRef.current = { x: e.clientX, y: e.clientY }
      forceRender((n) => n + 1)
    }

    const handleMouseUp = () => {
      const drag = dragRef.current
      if (!drag) return

      const guide = guides.find((g) => g.id === drag.guideId)
      dragRef.current = null
      mousePosRef.current = null
      forceRender((n) => n + 1)

      // Persist to DB
      if (guide && exhibitionId) {
        fetch(`/api/exhibitions/${exhibitionId}/guides`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guideId: guide.id, position: guide.position }),
        }).catch(console.error)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [guides, scaleFactor, exhibitionId, dispatch])

  if (!isRulersVisible) return null

  // Wall dimensions in canvas pixels
  const wallPxW = (wallWidth ?? 5) * WALL_SCALE
  const wallPxH = (wallHeight ?? 3) * WALL_SCALE

  // The wrapper is 50000x50000, wall is centered
  const W = 50000
  const ox = W / 2

  // Wall edges in canvas space
  const wallLeft = ox - wallPxW / 2
  const wallBottom = ox + wallPxH / 2

  return (
    <>
      <div className={styles.guidesContainer}>
        {guides.map((guide) => {
          const isSelected = guide.id === selectedGuideId
          const isDragging = dragRef.current?.guideId === guide.id

          // Convert metres to canvas-space px
          if (guide.orientation === 'vertical') {
            // Vertical guide: position is metres from left wall edge
            const canvasPx = wallLeft + guide.position * WALL_SCALE
            return (
              <div
                key={guide.id}
                className={`${styles.guide} ${styles.vertical} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
                style={{
                  left: `${canvasPx}px`,
                  ...(guidesLocked ? { pointerEvents: 'none' as const } : {}),
                }}
                onMouseDown={(e) => handleGuideMouseDown(e, guide.id, 'vertical')}
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch(selectGuide(guide.id))
                }}
              />
            )
          } else {
            // Horizontal guide: position is metres from bottom wall edge (up is positive)
            const canvasPx = wallBottom - guide.position * WALL_SCALE
            return (
              <div
                key={guide.id}
                className={`${styles.guide} ${styles.horizontal} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
                style={{
                  top: `${canvasPx}px`,
                  ...(guidesLocked ? { pointerEvents: 'none' as const } : {}),
                }}
                onMouseDown={(e) => handleGuideMouseDown(e, guide.id, 'horizontal')}
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch(selectGuide(guide.id))
                }}
              />
            )
          }
        })}
      </div>

      {/* Floating position label during drag — portal to escape CSS transforms */}
      {dragRef.current &&
        mousePosRef.current &&
        (() => {
          const draggingGuide = guides.find((g) => g.id === dragRef.current!.guideId)
          if (!draggingGuide) return null
          const isH = draggingGuide.orientation === 'horizontal'
          const positionCm = Math.round(draggingGuide.position * 100)
          const label = isH ? `y: ${positionCm} cm` : `x: ${positionCm} cm`
          return createPortal(
            <div
              style={{
                position: 'fixed',
                left: mousePosRef.current!.x + 16,
                top: mousePosRef.current!.y - 12,
                background: '#000',
                color: '#fff',
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'monospace',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 99999,
                letterSpacing: '0.5px',
              }}
            >
              {label}
            </div>,
            document.body,
          )
        })()}
    </>
  )
}

export default Guides
