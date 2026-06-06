'use client'

import { useEffect, useCallback } from 'react'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { reportImageError } from '@/lib/observability/reportImageError'

import styles from './ImageLightbox.module.scss'

type ImageLightboxProps = {
  imageUrl: string
  alt: string
  caption?: string
  onClose: () => void
}

/**
 * Full-screen lightbox for viewing high-resolution images.
 * Closes on backdrop click or Escape key.
 */
export const ImageLightbox = ({ imageUrl, alt, caption, onClose }: ImageLightboxProps) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-label={alt} onClick={handleBackdropClick}>
      <Button
        variant="ghost"
        icon="close"
        onClick={onClose}
        className={styles.closeButton}
        aria-label="Close lightbox"
      />
      <img
        src={imageUrl}
        alt={alt}
        className={styles.image}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        onError={() => reportImageError(imageUrl, { surface: 'lightbox', alt })}
        style={{ userSelect: 'none', WebkitTouchCallout: 'none' }}
      />
      {caption && (
        <Text as="p" className={styles.caption}>
          {caption}
        </Text>
      )}
    </div>
  )
}
