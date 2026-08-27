'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode, MouseEvent } from 'react'
import { X } from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

type ModalProps = {
  children: ReactNode
  onClose: () => void
  /**
   * ID of the element inside the modal that labels the dialog (usually
   * the modal's title heading). When provided it's forwarded to
   * `aria-labelledby` so screen readers announce the dialog by name on
   * open. Falls back to an unlabeled dialog if omitted.
   */
  titleId?: string
  /**
   * Optional override for the panel's max width (e.g. '640px'). Applied
   * inline so it wins over the default 560px without affecting other modals.
   */
  maxWidth?: string
  /**
   * Render a close button in the corner.
   *
   * Opt-in rather than default because four callers already draw their own, and
   * turning it on globally would give them two. Everything else closes only by
   * ESC or a backdrop click — neither of which exists or is discoverable on a
   * touch screen, so any modal a buyer meets on a phone should set this.
   */
  showClose?: boolean
}

import styles from './Modal.module.scss'

const Modal = ({ children, onClose, titleId, maxWidth, showClose }: ModalProps) => {
  const mouseDownOnBackdrop = useRef(false)
  const mouseDownAt = useRef<{ x: number; y: number } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Pointer travel above this is a drag, not a click. Covers the ordinary
  // wobble between pressing and releasing without swallowing real clicks.
  const DRAG_TOLERANCE_PX = 5

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // Only mark if the mousedown was directly on the backdrop (not a child)
    mouseDownOnBackdrop.current = e.target === e.currentTarget
    mouseDownAt.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    // Close only if BOTH mousedown and mouseup happened on the backdrop AND the
    // pointer barely moved. Without the distance check a DRAG that begins and
    // ends on the backdrop counts as a click — which silently dismissed the
    // dialog whenever someone tried to drag something underneath it, such as
    // panning the 3D camera behind the exhibition's exit prompt.
    const from = mouseDownAt.current
    const travelled = from ? Math.hypot(e.clientX - from.x, e.clientY - from.y) : Infinity

    if (
      mouseDownOnBackdrop.current &&
      e.target === e.currentTarget &&
      travelled <= DRAG_TOLERANCE_PX
    ) {
      onClose()
    }
    mouseDownOnBackdrop.current = false
    mouseDownAt.current = null
  }

  // ESC closes the modal — standard affordance every assistive-tech user
  // expects. Attached at document scope so it fires regardless of which
  // focused element is inside the modal.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Move focus into the modal on mount so keyboard users aren't left
  // focused behind the backdrop, and restore focus to whatever was
  // active before the modal opened when it closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    contentRef.current?.focus()
    return () => {
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div
      className={styles.modal}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      data-no-deselect="true"
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.content}
        // Bounded by the viewport even when a caller names a width. As a bare
        // inline value this overrode the stylesheet's cap, so a modal asking for
        // 640px ran to both edges of a 390px phone.
        style={maxWidth ? { maxWidth: `min(${maxWidth}, 100%)` } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && (
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

export default Modal
