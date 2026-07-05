'use client'

import Image, { type ImageProps } from 'next/image'

import { isSafeImageSrc } from '@/lib/imageSafety'
import { reportImageError } from '@/lib/observability/reportImageError'

import styles from './ProtectedImage.module.scss'

/**
 * Image wrapper that prevents non-technical users from easily
 * downloading or saving images via right-click, drag, or long-press.
 *
 * Also guards against unconfigured image hostnames — if the URL
 * isn't in the allowed list, renders a placeholder instead of crashing.
 */
type ProtectedImageProps = ImageProps & {
  /** Optional extra className applied to the wrapper div */
  wrapperClassName?: string
}

export const ProtectedImage = ({
  wrapperClassName,
  fill,
  className,
  // Default to skipping the Vercel /_next/image optimizer. Our sources are
  // already-optimized .webp on an immutable R2/CDN; re-fetching + re-encoding
  // them on a cold transform is what caused images to break on first load and
  // only appear after a refresh (AR-125). Callers can still pass unoptimized={false}.
  unoptimized = true,
  onError,
  ...props
}: ProtectedImageProps) => {
  const wrapperStyle = fill ? styles.fill : styles.wrapper

  // Guard: don't pass unsafe URLs to next/image
  if (!isSafeImageSrc(props.src as string)) {
    return (
      <div
        className={`${wrapperStyle}${wrapperClassName ? ` ${wrapperClassName}` : ''}`}
        style={{ backgroundColor: 'var(--color-gray-20)' }}
      />
    )
  }

  return (
    <div
      className={`${wrapperStyle}${wrapperClassName ? ` ${wrapperClassName}` : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <Image
        {...props}
        fill={fill}
        unoptimized={unoptimized}
        className={className}
        draggable={false}
        onError={(e) => {
          // Broken images don't throw — report so we see them in Sentry (AR-125).
          reportImageError(props.src as string, {
            surface: 'protected-image',
            alt: typeof props.alt === 'string' ? props.alt : undefined,
          })
          onError?.(e)
        }}
      />
    </div>
  )
}
