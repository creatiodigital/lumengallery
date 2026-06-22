'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode, MouseEvent } from 'react'

type ModalProps = {
  children: ReactNode
  onClose: () => void
  /**
   * ID of the element inside the modal that labels the dialog (usually
   * the modal's title heading). When provided it's forwarded to
   * `aria-labelledby` so screen readers announce the dialog by name on
   * open. Falls back to an unlabelled dialog if omitted.
   */
  titleId?: string
  /**
   * Optional override for the panel's max width (e.g. '640px'). Applied
   * inline so it wins over the default 560px without affecting other modals.
   */
  maxWidth?: string
}

import styles from './Modal.module.scss'

const Modal = ({ children, onClose, titleId, maxWidth }: ModalProps) => {
  const mouseDownOnBackdrop = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // Only mark if the mousedown was directly on the backdrop (not a child)
    mouseDownOnBackdrop.current = e.target === e.currentTarget
  }

  const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    // Close only if BOTH mousedown and mouseup happened on the backdrop
    if (mouseDownOnBackdrop.current && e.target === e.currentTarget) {
      onClose()
    }
    mouseDownOnBackdrop.current = false
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
        style={maxWidth ? { maxWidth } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export default Modal
