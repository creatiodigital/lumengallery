'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import type { RootState } from '@/redux/store'
import { WALL_SCALE } from '@/components/wallview/constants'
import {
  addGuide,
  removeGuide,
  removeGroup,
  chooseCurrentArtworkId,
} from '@/redux/slices/wallViewSlice'

import styles from './Ruler.module.scss'

// WALL_SCALE = 400 means 1cm = 4px in canvas space
// 1m = 100cm * 4px = 400px in canvas space

const RULER_THICKNESS = 24 // px

/**
 * Draw ruler tick marks & labels onto a canvas.
 *
 * The ruler is in *screen* pixels.  We derive the "visible range" from
 * the pan/scale transform so that the tick labels show real-world metres.
 *
 * originCanvasPx: the canvas-space coordinate that should read as 0
 * flip: if true, values increase in the negative screen direction (for vertical: 0 at bottom)
 */
function drawRuler(
  ctx: CanvasRenderingContext2D,
  length: number, // canvas dimension in px
  orientation: 'horizontal' | 'vertical',
  scaleFactor: number,
  canvasAtScreen0: number, // canvas-space coordinate at the ruler's left/top edge
  originCanvasPx: number, // canvas-space coordinate where ruler reads 0
  flip: boolean, // if true, positive direction is reversed (up instead of down)
) {
  const dpr = window.devicePixelRatio || 1

  // Set up canvas for high-DPI
  if (orientation === 'horizontal') {
    ctx.canvas.width = length * dpr
    ctx.canvas.height = RULER_THICKNESS * dpr
    ctx.canvas.style.width = `${length}px`
    ctx.canvas.style.height = `${RULER_THICKNESS}px`
  } else {
    ctx.canvas.width = RULER_THICKNESS * dpr
    ctx.canvas.height = length * dpr
    ctx.canvas.style.width = `${RULER_THICKNESS}px`
    ctx.canvas.style.height = `${length}px`
  }
  ctx.scale(dpr, dpr)

  // Background
  ctx.fillStyle = '#2a2a2a'
  if (orientation === 'horizontal') {
    ctx.fillRect(0, 0, length, RULER_THICKNESS)
  } else {
    ctx.fillRect(0, 0, RULER_THICKNESS, length)
  }

  // canvasAtScreen0 is now passed in directly from the caller

  // Convert canvas-space to metres, relative to the given origin
  // flip=true means positive metres go in the negative canvas direction
  const canvasToMetres = (cpx: number) => {
    const delta = cpx - originCanvasPx
    return (flip ? -delta : delta) / WALL_SCALE
  }

  // Determine tick spacing based on zoom
  const screenPxPerMetre = WALL_SCALE * scaleFactor
  let majorSpacingM = 1

  if (screenPxPerMetre < 30) {
    majorSpacingM = 5
  } else if (screenPxPerMetre < 60) {
    majorSpacingM = 2
  } else if (screenPxPerMetre < 120) {
    majorSpacingM = 1
  } else if (screenPxPerMetre < 400) {
    majorSpacingM = 0.5
  } else if (screenPxPerMetre < 800) {
    majorSpacingM = 0.25
  } else {
    majorSpacingM = 0.1
  }

  const minorDivisions = 5

  // Find the range of metres visible on screen
  const canvasPerScreen = 1 / scaleFactor
  const startMetres = canvasToMetres(canvasAtScreen0)
  const endMetres = canvasToMetres(canvasAtScreen0 + length * canvasPerScreen)
  const minM = Math.min(startMetres, endMetres)
  const maxM = Math.max(startMetres, endMetres)

  const firstMajor = Math.floor(minM / majorSpacingM) * majorSpacingM
  const lastMajor = Math.ceil(maxM / majorSpacingM) * majorSpacingM

  // Convert metres back to screen position
  const metresToScreen = (m: number) => {
    const canvasPx = (flip ? -m : m) * WALL_SCALE + originCanvasPx
    return (canvasPx - canvasAtScreen0) * scaleFactor
  }

  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 0.5

  // Draw ticks
  for (let m = firstMajor; m <= lastMajor + majorSpacingM * 0.01; m += majorSpacingM) {
    const screenPos = metresToScreen(m)

    // Major tick
    if (orientation === 'horizontal') {
      ctx.beginPath()
      ctx.moveTo(screenPos, RULER_THICKNESS)
      ctx.lineTo(screenPos, RULER_THICKNESS * 0.35)
      ctx.stroke()

      // Label
      ctx.fillStyle = '#fff'
      ctx.font = '9px Inter, sans-serif'
      ctx.textAlign = 'center'
      const label = Math.abs(m) < 0.001 ? '0' : `${Math.round(m * 100)}`
      ctx.fillText(label, screenPos, 10)
    } else {
      ctx.beginPath()
      ctx.moveTo(RULER_THICKNESS, screenPos)
      ctx.lineTo(RULER_THICKNESS * 0.35, screenPos)
      ctx.stroke()

      // Label (rotated)
      ctx.save()
      ctx.translate(10, screenPos)
      ctx.rotate(-Math.PI / 2)
      ctx.fillStyle = '#fff'
      ctx.font = '9px Inter, sans-serif'
      ctx.textAlign = 'center'
      const label = Math.abs(m) < 0.001 ? '0' : `${Math.round(m * 100)}`
      ctx.fillText(label, 0, 4)
      ctx.restore()
    }

    // Minor ticks
    const minorSpacing = majorSpacingM / minorDivisions
    for (let j = 1; j < minorDivisions; j++) {
      const minorM = m + j * minorSpacing
      const minorPos = metresToScreen(minorM)
      ctx.strokeStyle = '#666'

      if (orientation === 'horizontal') {
        ctx.beginPath()
        ctx.moveTo(minorPos, RULER_THICKNESS)
        ctx.lineTo(minorPos, RULER_THICKNESS * 0.65)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.moveTo(RULER_THICKNESS, minorPos)
        ctx.lineTo(RULER_THICKNESS * 0.65, minorPos)
        ctx.stroke()
      }
    }
    ctx.strokeStyle = '#fff'
  }

  // Bottom/right edge line
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 1
  if (orientation === 'horizontal') {
    ctx.beginPath()
    ctx.moveTo(0, RULER_THICKNESS - 0.5)
    ctx.lineTo(length, RULER_THICKNESS - 0.5)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(RULER_THICKNESS - 0.5, 0)
    ctx.lineTo(RULER_THICKNESS - 0.5, length)
    ctx.stroke()
  }
}

export const Ruler = () => {
  const isRulersVisible = useSelector((state: RootState) => state.wallView.isRulersVisible)
  const scaleFactor = useSelector((state: RootState) => state.wallView.scaleFactor)
  const panPosition = useSelector((state: RootState) => state.wallView.panPosition)
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)

  const hCanvasRef = useRef<HTMLCanvasElement>(null)
  const vCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const dispatch = useDispatch()
  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)

  // Drag-from-ruler state
  const [rulerDrag, setRulerDrag] = useState<{
    orientation: 'horizontal' | 'vertical'
    screenPos: number // current mouse position in screen px
  } | null>(null)

  const draw = useCallback(() => {
    const { w, h } = sizeRef.current
    if (w === 0 || h === 0) return

    const W = 50000
    const ox = W / 2 // wrapper center / transform-origin = 25000

    // Wall dimensions in canvas pixels (meters * WALL_SCALE)
    const wallPxW = (wallWidth ?? 5) * WALL_SCALE
    const wallPxH = (wallHeight ?? 3) * WALL_SCALE

    // Wall origin: left edge (horizontal), bottom edge (vertical)
    const wallLeftCanvasPx = ox - wallPxW / 2
    const wallBottomCanvasPx = ox + wallPxH / 2

    // CSS translate values in px (translate applied after scale in CSS)
    const tx = (panPosition.x / 100) * W
    const ty = (panPosition.y / 100) * W

    const hLen = w - RULER_THICKNESS
    const vLen = h - RULER_THICKNESS

    // Derive canvas-space coordinate at the ruler's left/top edge.
    // CSS: wrapper at left:50%;top:50%, transform: translate(panX%,panY%) scale(s)
    //   containerPos = containerSize/2 + (canvasPx - ox)*s + tx + ox
    // Ruler left edge = containerX RULER_THICKNESS (horizontal), so:
    //   canvasAtScreen0 = (RULER_THICKNESS - containerW/2 - tx - ox) / s + ox
    const canvasAtScreen0_h = (RULER_THICKNESS - w / 2 - tx - ox) / scaleFactor + ox
    const canvasAtScreen0_v = (RULER_THICKNESS - h / 2 - ty - ox) / scaleFactor + ox

    if (hCanvasRef.current) {
      const ctx = hCanvasRef.current.getContext('2d')
      if (ctx) {
        drawRuler(ctx, hLen, 'horizontal', scaleFactor, canvasAtScreen0_h, wallLeftCanvasPx, false)
      }
    }

    if (vCanvasRef.current) {
      const ctx = vCanvasRef.current.getContext('2d')
      if (ctx) {
        drawRuler(ctx, vLen, 'vertical', scaleFactor, canvasAtScreen0_v, wallBottomCanvasPx, true)
      }
    }
  }, [scaleFactor, panPosition, wallWidth, wallHeight])

  // Use ResizeObserver to track container size reliably
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        sizeRef.current = { w: entry.contentRect.width, h: entry.contentRect.height }
        draw()
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [draw])

  // Also redraw when zoom/pan change
  useEffect(() => {
    draw()
  }, [draw])

  // ---- Drag from ruler to create guide ----
  const handleRulerMouseDown = useCallback(
    (orientation: 'horizontal' | 'vertical', e: React.MouseEvent) => {
      e.preventDefault()
      dispatch(removeGroup())
      dispatch(chooseCurrentArtworkId(null))
      const pos = orientation === 'horizontal' ? e.clientY : e.clientX
      setRulerDrag({ orientation, screenPos: pos })
    },
    [dispatch],
  )

  useEffect(() => {
    if (!rulerDrag) return

    const handleMouseMove = (e: MouseEvent) => {
      const pos = rulerDrag.orientation === 'horizontal' ? e.clientY : e.clientX
      setRulerDrag((prev) => (prev ? { ...prev, screenPos: pos } : null))
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!rulerDrag || !containerRef.current || !currentWallId || !exhibitionId) {
        setRulerDrag(null)
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      const { w, h } = sizeRef.current
      const W = 50000
      const ox = W / 2
      const tx = (panPosition.x / 100) * W
      const ty = (panPosition.y / 100) * W
      const wallPxW = (wallWidth ?? 5) * WALL_SCALE
      const wallPxH = (wallHeight ?? 3) * WALL_SCALE

      if (rulerDrag.orientation === 'vertical') {
        // Vertical guide: dragged from left ruler
        const screenX = e.clientX - rect.left - RULER_THICKNESS
        // Convert screen px to canvas-space px
        const canvasAtScreen0 = (RULER_THICKNESS - w / 2 - tx - ox) / scaleFactor + ox
        const canvasPx = canvasAtScreen0 + screenX / scaleFactor
        // Canvas-space to metres from wall left edge
        const wallLeft = ox - wallPxW / 2
        const positionM = (canvasPx - wallLeft) / WALL_SCALE

        // Create guide
        const tempId = crypto.randomUUID()
        dispatch(
          addGuide({
            id: tempId,
            wallId: currentWallId,
            orientation: 'vertical',
            position: positionM,
          }),
        )

        // Persist to DB and update with real ID
        fetch(`/api/exhibitions/${exhibitionId}/guides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallId: currentWallId,
            orientation: 'vertical',
            position: positionM,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            // Replace temp guide with DB guide
            dispatch(
              addGuide({
                id: data.id,
                wallId: data.wallId,
                orientation: data.orientation,
                position: data.position,
              }),
            )
            // Remove temp
            dispatch(removeGuide(tempId))
          })
          .catch(console.error)
      } else {
        // Horizontal guide: dragged from top ruler
        const screenY = e.clientY - rect.top - RULER_THICKNESS
        const canvasAtScreen0 = (RULER_THICKNESS - h / 2 - ty - ox) / scaleFactor + ox
        const canvasPx = canvasAtScreen0 + screenY / scaleFactor
        // Canvas-space to metres from wall bottom edge (up is positive)
        const wallBottom = ox + wallPxH / 2
        const positionM = (wallBottom - canvasPx) / WALL_SCALE

        const tempId = crypto.randomUUID()
        dispatch(
          addGuide({
            id: tempId,
            wallId: currentWallId,
            orientation: 'horizontal',
            position: positionM,
          }),
        )

        fetch(`/api/exhibitions/${exhibitionId}/guides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallId: currentWallId,
            orientation: 'horizontal',
            position: positionM,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            dispatch(
              addGuide({
                id: data.id,
                wallId: data.wallId,
                orientation: data.orientation,
                position: data.position,
              }),
            )
            dispatch(removeGuide(tempId))
          })
          .catch(console.error)
      }

      setRulerDrag(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    rulerDrag,
    panPosition,
    wallWidth,
    wallHeight,
    scaleFactor,
    currentWallId,
    exhibitionId,
    dispatch,
  ])

  // Compute preview guide position for rendering
  const previewStyle =
    rulerDrag && containerRef.current
      ? (() => {
          const rect = containerRef.current.getBoundingClientRect()
          if (rulerDrag.orientation === 'vertical') {
            const x = rulerDrag.screenPos - rect.left
            return { left: `${x}px`, top: 0, bottom: 0, width: '1px' } as React.CSSProperties
          } else {
            const y = rulerDrag.screenPos - rect.top
            return { top: `${y}px`, left: 0, right: 0, height: '1px' } as React.CSSProperties
          }
        })()
      : null

  return (
    <div
      ref={containerRef}
      className={styles.rulers}
      style={{ display: isRulersVisible ? undefined : 'none' }}
    >
      <div className={styles.corner} />
      <canvas
        ref={hCanvasRef}
        className={styles.horizontal}
        onMouseDown={(e) => handleRulerMouseDown('horizontal', e)}
      />
      <canvas
        ref={vCanvasRef}
        className={styles.vertical}
        onMouseDown={(e) => handleRulerMouseDown('vertical', e)}
      />
      {rulerDrag && previewStyle && <div className={styles.previewGuide} style={previewStyle} />}
    </div>
  )
}

export default Ruler
