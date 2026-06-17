'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Text } from '@/components/ui/Typography'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'
import type { RootState } from '@/redux/store'

import styles from './MediaLibrary.module.scss'

// Extracts first frame from a video and applies it as the background of a div
function useVideoThumbnail(videoUrl: string | null | undefined) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!videoUrl) return

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
        setDataUrl(canvas.toDataURL('image/jpeg', 0.7))
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
  }, [videoUrl])

  return dataUrl
}

// Component that renders a video first-frame as a full-cover background overlay
function VideoThumbnailOverlay({ videoUrl }: { videoUrl: string }) {
  const dataUrl = useVideoThumbnail(videoUrl)

  if (!dataUrl) {
    return <Icon name="video" size={32} color="#333" />
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${dataUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 'inherit',
      }}
    />
  )
}

type Artwork = {
  id: string
  name: string
  title?: string | null
  artworkType: string
  imageUrl?: string | null
  textContent?: string | null
  soundUrl?: string | null
  videoUrl?: string | null
}

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

type MediaLibraryProps = {
  onClose: () => void
  onClickArtwork: (artwork: Artwork) => void
  duplicateError?: string | null
}

export const MediaLibrary = ({ onClose, onClickArtwork, duplicateError }: MediaLibraryProps) => {
  // Use effectiveUser to get the impersonated artist's ID when admin is impersonating
  const { effectiveUser } = useEffectiveUser()
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'text' | 'sound' | 'video'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Get artworks already in this exhibition to filter them out
  const exhibitionArtworkIds = useSelector((state: RootState) => state.artworks.allIds)

  useEffect(() => {
    const fetchArtworks = async () => {
      if (!effectiveUser?.id) return

      try {
        // Use effectiveUser.id to fetch artworks of the impersonated artist (not the admin)
        const response = await fetch(`/api/artworks?userId=${effectiveUser.id}`)
        const data = await response.json()
        setArtworks(data)
      } catch (error) {
        console.error('Failed to fetch artworks:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArtworks()
  }, [effectiveUser?.id])

  // Filter out artworks already in this exhibition
  const availableArtworks = artworks
    .filter((artwork) => !exhibitionArtworkIds.includes(artwork.id))
    .filter((artwork) => typeFilter === 'all' || artwork.artworkType === typeFilter)
    .filter((artwork) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        artwork.title?.toLowerCase().includes(q) ||
        artwork.name.toLowerCase().includes(q) ||
        artwork.textContent?.toLowerCase().includes(q)
      )
    })

  const handleDragStart = (e: React.DragEvent, artwork: Artwork) => {
    e.dataTransfer.setData('existingArtworkId', artwork.id)
    e.dataTransfer.setData('existingArtworkType', artwork.artworkType)
  }

  // Sound preview playback (single audio at a time)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const handleTogglePlay = useCallback(
    (artworkId: string, soundUrl: string) => {
      // Same sound — stop it
      if (audioRef.current && playingId === artworkId) {
        audioRef.current.pause()
        audioRef.current = null
        setPlayingId(null)
        return
      }

      // Stop any current sound
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      // Play new sound (no loop)
      const audio = new Audio(soundUrl)
      audio.addEventListener('ended', () => {
        setPlayingId(null)
        audioRef.current = null
      })
      audio.play()
      audioRef.current = audio
      setPlayingId(artworkId)
    },
    [playingId],
  )

  return (
    <div className={styles.sidebar} data-no-deselect="true">
      <div className={styles.header}>
        <Text font="dashboard" as="h3">
          Media Library
        </Text>
        <Button
          variant="ghost"
          icon="close"
          onClick={onClose}
          className={styles.closeButton}
          aria-label="Close"
        />
      </div>

      <div className={styles.tabs}>
        {(['all', 'image', 'text', 'sound', 'video'] as const).map((type) => (
          <Button
            key={type}
            variant="tab"
            className={styles.tab}
            onClick={() => setTypeFilter(type)}
            aria-pressed={typeFilter === type}
            label={
              type === 'all'
                ? 'All'
                : type === 'image'
                  ? 'Images'
                  : type === 'text'
                    ? 'Text'
                    : type === 'sound'
                      ? 'Sound'
                      : 'Video'
            }
          />
        ))}
      </div>

      <div className={styles.searchWrapper}>
        <Input
          type="text"
          inputClassName={styles.searchInput}
          placeholder="Search artworks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search artworks"
        />
      </div>

      {duplicateError && (
        <div className={styles.errorWrapper}>
          <ErrorText>{duplicateError}</ErrorText>
        </div>
      )}

      {loading ? (
        <LoadingBar />
      ) : availableArtworks.length === 0 ? (
        <Text font="dashboard" as="p" className={styles.empty}>
          {artworks.length === 0
            ? 'No artworks in library. Create some first!'
            : 'All artworks are already in this exhibition.'}
        </Text>
      ) : (
        <div className={styles.grid}>
          {availableArtworks.map((artwork) => (
            <div key={artwork.id} className={styles.itemWrapper}>
              <div
                className={styles.item}
                onClick={() => onClickArtwork(artwork)}
                draggable
                onDragStart={(e) => handleDragStart(e, artwork)}
                style={
                  (artwork.artworkType === 'image' || artwork.artworkType === 'video') &&
                  artwork.imageUrl
                    ? {
                        backgroundImage: `url(${artwork.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
              >
                {/* Show image, text preview, or icon */}
                {(artwork.artworkType === 'image' || artwork.artworkType === 'video') &&
                artwork.imageUrl ? null : artwork.artworkType === 'video' && artwork.videoUrl ? (
                  <VideoThumbnailOverlay videoUrl={artwork.videoUrl} />
                ) : artwork.artworkType === 'text' && artwork.textContent ? (
                  <span className={styles.textPreview}>
                    {truncateText(artwork.textContent, 50)}
                  </span>
                ) : artwork.artworkType === 'sound' ? (
                  <div
                    className={`${styles.soundPlayBtn} ${artwork.soundUrl ? styles.playable : ''}`}
                    onClick={(e) => {
                      if (artwork.soundUrl) {
                        e.stopPropagation()
                        handleTogglePlay(artwork.id, artwork.soundUrl)
                      }
                    }}
                  >
                    <Icon
                      name={
                        playingId === artwork.id ? 'square' : artwork.soundUrl ? 'play' : 'volume-2'
                      }
                      size={32}
                      color={playingId === artwork.id ? '#e53e3e' : '#333'}
                    />
                  </div>
                ) : (
                  <Icon
                    name={
                      artwork.artworkType === 'image'
                        ? 'image'
                        : artwork.artworkType === 'video'
                          ? 'video'
                          : 'type'
                    }
                    size={32}
                    color="#333"
                  />
                )}
              </div>
              <span className={styles.name}>{artwork.title || artwork.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
