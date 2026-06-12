'use client'

import { useState, useEffect } from 'react'

import { Icon } from '@/components/ui/Icon'
import { Tooltip } from '@/components/ui/Tooltip'
import type { TArtwork } from '@/types/artwork'

import { WALL_SCALE } from '@/components/wallview/constants'
import { assetUrl } from '@/lib/assetUrl'

import styles from './ArtisticVideo.module.scss'

type ArtisticVideoProps = {
  artwork: TArtwork
}

const ArtisticVideo = ({ artwork }: ArtisticVideoProps) => {
  const {
    showFrame,
    frameColor,
    frameSize,
    frameMaterial,
    frameTextureScale,
    frameTextureRotation,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    videoUrl,
  } = artwork

  // Extract first frame from video when no poster image exists
  const [videoFrameUrl, setVideoFrameUrl] = useState<string | null>(null)
  useEffect(() => {
    if (imageUrl || !videoUrl) {
      setVideoFrameUrl(null)
      return
    }

    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = videoUrl

    const handleLoadedData = () => {
      video.currentTime = 0
    }
    const handleSeeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        setVideoFrameUrl(canvas.toDataURL('image/jpeg', 0.7))
      }
      video.removeAttribute('src')
      video.load()
    }

    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('seeked', handleSeeked)

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('seeked', handleSeeked)
      video.removeAttribute('src')
      video.load()
    }
  }, [imageUrl, videoUrl])

  // The display image: poster → video first frame → none
  const displayImageUrl = imageUrl || videoFrameUrl

  const frameFolder = (frameMaterial === 'wood' ? 'wood-dark' : (frameMaterial ?? 'wood-dark')).replace('wood-', '')
  const frameTextureUrl = assetUrl(`/assets/materials/wooden-frame-${frameFolder}/diffuse.jpg`)

  return (
    <div
      className={styles.frame}
      style={{
        ...(showFrame && displayImageUrl && (frameMaterial ?? 'plastic') === 'plastic'
          ? {
              border: `${(frameSize?.value ?? 3) * (WALL_SCALE / 100)}px solid ${frameColor ?? '#000000'}`,
            }
          : showFrame && displayImageUrl && frameMaterial?.startsWith('wood')
            ? {
                padding: `${(frameSize?.value ?? 3) * (WALL_SCALE / 100)}px`,
                position: 'relative' as const,
                overflow: 'hidden' as const,
              }
            : {}),
      }}
    >
      {/* Wood frame backdrop */}
      {showFrame && displayImageUrl && frameMaterial?.startsWith('wood') && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: '-50%',
              width: '200%',
              height: '200%',
              backgroundImage: `url('${frameTextureUrl}')`,
              backgroundSize: `${(frameTextureScale ?? 2) * 25}%`,
              backgroundPosition: '50% 50%',
              backgroundRepeat: 'repeat',
              transform: `rotate(${frameTextureRotation ?? 0}deg)`,
              transformOrigin: 'center center',
              zIndex: 0,
              pointerEvents: 'none' as const,
            }}
          />
          {frameColor && frameColor !== '#ffffff' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: frameColor,
                opacity: 0.75,
                zIndex: 0,
                pointerEvents: 'none' as const,
              }}
            />
          )}
        </>
      )}
      <div
        className={styles.passepartout}
        style={{
          border:
            showPassepartout && displayImageUrl && passepartoutSize
              ? `${passepartoutSize.value * (WALL_SCALE / 100)}px solid ${passepartoutColor}`
              : undefined,
          ...(showFrame && frameMaterial?.startsWith('wood')
            ? { position: 'relative' as const, zIndex: 1 }
            : {}),
        }}
      >
        <div
          className={styles.image}
          style={{
            backgroundImage: displayImageUrl ? `url(${displayImageUrl})` : 'none',
          }}
        >
          {!displayImageUrl && (
            <div className={styles.empty}>
              <Tooltip label="Upload a video via the artwork library" placement="top">
                <span style={{ display: 'inline-flex' }}>
                  <Icon name="video" size={40} color="#000000" />
                </span>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* Video indicator badge */}
      {displayImageUrl && (
        <div className={styles.videoIndicator}>
          <Icon name="video" size={14} color="#ffffff" />
        </div>
      )}
    </div>
  )
}

export default ArtisticVideo
