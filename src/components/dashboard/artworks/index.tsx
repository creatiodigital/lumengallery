'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { isSafeImageSrc } from '@/lib/imageSafety'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import { AddArtworkModal } from '@/components/dashboard/AddArtworkModal'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'

import { DashboardLayout } from '../DashboardLayout'
import dashboardStyles from '../DashboardLayout/DashboardLayout.module.scss'
import styles from './artworks.module.scss'

// Helper to truncate text
const truncateText = (text: string | null | undefined, maxLength: number): string => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

type Exhibition = {
  id: string
  mainTitle: string
}

type ExhibitionArtwork = {
  id: string
  exhibitionId: string
  exhibition: Exhibition
}

type Artwork = {
  id: string
  name: string
  artworkType: string
  title: string | null
  year: string | null
  technique: string | null
  imageUrl: string | null
  videoUrl: string | null
  textContent: string | null
  soundUrl: string | null
  createdAt: string
  order?: number
  exhibitionArtworks: ExhibitionArtwork[]
}

// Extracts first frame from a video URL and renders it as a thumbnail
function VideoThumbnail({ videoUrl, alt }: { videoUrl: string; alt: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
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
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        setReady(true)
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

  return (
    <canvas
      ref={canvasRef}
      aria-label={alt}
      style={{
        width: 60,
        height: 60,
        objectFit: 'cover',
        borderRadius: 'var(--radius-sm)',
        display: ready ? 'block' : 'none',
      }}
    />
  )
}

type ArtworkCardProps = {
  artwork: Artwork
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
  onUnlink: (exhibitionArtworkId: string, artworkName: string, exhibitionTitle: string) => void
  playingArtworkId: string | null
  onTogglePlay: (artworkId: string, soundUrl: string) => void
  /** Hidden when a filter / search is active — dragging a subset would
   *  scramble the order of items currently hidden by the filter. */
  draggable: boolean
}

function SortableArtworkCard(props: ArtworkCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.artwork.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.sortableRow}>
      {props.draggable && (
        <div className={styles.dragHandle} {...attributes} {...listeners}>
          <span className={styles.dragIcon}>⠿</span>
        </div>
      )}
      <ArtworkCard {...props} />
    </div>
  )
}

function ArtworkCard({
  artwork,
  onEdit,
  onDelete,
  onUnlink,
  playingArtworkId,
  onTogglePlay,
}: ArtworkCardProps) {
  const isPlaying = playingArtworkId === artwork.id

  return (
    <div className={styles.card}>
      {/* Thumbnail / Text Preview */}
      <div className={styles.cardThumbnail}>
        {(artwork.artworkType === 'image' || artwork.artworkType === 'video') &&
        artwork.imageUrl &&
        isSafeImageSrc(artwork.imageUrl) ? (
          <Image
            src={artwork.imageUrl}
            alt={artwork.title || 'Artwork'}
            width={60}
            height={60}
            // Skip the Vercel optimizer (already-optimized R2/CDN .webp); cold
            // re-encodes broke images on first load (AR-125).
            unoptimized
            className={styles.thumbnail}
          />
        ) : artwork.artworkType === 'video' && artwork.videoUrl ? (
          <VideoThumbnail videoUrl={artwork.videoUrl} alt={artwork.title || 'Video'} />
        ) : artwork.artworkType === 'text' && artwork.textContent ? (
          <div className={styles.textPreview}>{truncateText(artwork.textContent, 100)}</div>
        ) : artwork.artworkType === 'sound' ? (
          <div
            className={`${styles.placeholder} ${artwork.soundUrl ? styles.soundPlayable : ''}`}
            onClick={(e) => {
              if (artwork.soundUrl) {
                e.stopPropagation()
                onTogglePlay(artwork.id, artwork.soundUrl)
              }
            }}
            role={artwork.soundUrl ? 'button' : undefined}
            tabIndex={artwork.soundUrl ? 0 : undefined}
          >
            <Icon
              name={isPlaying ? 'square' : artwork.soundUrl ? 'play' : 'volume-2'}
              size={32}
              color={isPlaying ? '#e53e3e' : artwork.soundUrl ? '#333' : '#666'}
            />
          </div>
        ) : (
          <div className={styles.placeholder}>
            <Icon
              name={
                artwork.artworkType === 'image'
                  ? 'image'
                  : artwork.artworkType === 'video'
                    ? 'video'
                    : 'type'
              }
              size={32}
              color="#666"
            />
          </div>
        )}
      </div>
      <div className={styles.cardInfo}>
        <Text font="dashboard" as="h3">
          {artwork.title}
        </Text>
        {artwork.exhibitionArtworks.length > 0 && (
          <div className={styles.exhibitions}>
            <span className={styles.exhibitionsLabel}>In:</span>
            {artwork.exhibitionArtworks.map((ea) => (
              <span key={ea.id} className={styles.exhibitionTag}>
                {ea.exhibition.mainTitle}
                <Button
                  variant="ghost"
                  className={styles.removeBtn}
                  onClick={() =>
                    onUnlink(ea.id, artwork.title || 'Artwork', ea.exhibition.mainTitle)
                  }
                  title={`Remove from ${ea.exhibition.mainTitle}`}
                  aria-label={`Remove from ${ea.exhibition.mainTitle}`}
                >
                  <Icon name="close" size={14} />
                </Button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.cardActions}>
        <Button variant="secondary" label="Edit" onClick={() => onEdit(artwork.id)} />
        <Button
          variant="secondary"
          label="Delete"
          onClick={() => onDelete(artwork.id, artwork.title || 'Artwork')}
        />
      </div>
    </div>
  )
}

export const ArtworkLibraryPage = () => {
  const { effectiveUser } = useEffectiveUser()
  const router = useRouter()

  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [unlinkTarget, setUnlinkTarget] = useState<{
    exhibitionArtworkId: string
    artworkName: string
    exhibitionTitle: string
  } | null>(null)
  const [unlinking, setUnlinking] = useState(false)
  const [actionError, setActionError] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'text' | 'sound' | 'video'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Sound preview playback
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingArtworkId, setPlayingArtworkId] = useState<string | null>(null)

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
      // If the same artwork is already playing, stop it
      if (audioRef.current && playingArtworkId === artworkId) {
        audioRef.current.pause()
        audioRef.current = null
        setPlayingArtworkId(null)
        return
      }

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      // Play the new sound
      const audio = new Audio(soundUrl)
      audio.addEventListener('ended', () => {
        setPlayingArtworkId(null)
        audioRef.current = null
      })
      audio.play()
      audioRef.current = audio
      setPlayingArtworkId(artworkId)
    },
    [playingArtworkId],
  )

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filter artworks based on selected type and search query
  const filteredArtworks = artworks.filter((artwork) => {
    // Shapes are a 2D-canvas / wallview construct, never user-managed
    // content. Hide them from the main library regardless of the type
    // filter (they still load in the wallview's MediaLibrary).
    if (artwork.artworkType === 'shape') return false
    // Type filter
    if (typeFilter !== 'all' && artwork.artworkType !== typeFilter) {
      return false
    }
    // Search filter (case-insensitive, matches title, name, and text content)
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase()
      return (
        artwork.title?.toLowerCase().includes(searchLower) ||
        artwork.name.toLowerCase().includes(searchLower) ||
        artwork.textContent?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  // Display order = the artist's saved order (Artwork.order, asc). The
  // /api/artworks endpoint already returns rows in that order, so we
  // just preserve the filter's pass-through.
  const sortedArtworks = filteredArtworks
  // Drag-reorder is available on the All tab AND inside any type filter, so an
  // artist can reorder one media type (e.g. 39 images) without the other types
  // as noise. Disabled only while searching — search results are a scattered
  // subset, not a coherent reorderable list.
  const dragEnabled = debouncedSearch.length === 0

  // Fetch artworks
  const fetchArtworks = useCallback(async () => {
    if (!effectiveUser?.id) return

    try {
      const response = await fetch(`/api/artworks?userId=${effectiveUser.id}`)
      const data = await response.json()
      setArtworks(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch artworks:', error)
    } finally {
      setLoading(false)
    }
  }, [effectiveUser?.id])

  useEffect(() => {
    if (effectiveUser?.id) {
      fetchArtworks()
    }
  }, [effectiveUser?.id, fetchArtworks])

  const handleAddSuccess = useCallback(() => {
    fetchArtworks()
  }, [fetchArtworks])

  const handleDeleteClick = useCallback((id: string, name: string) => {
    setActionError('')
    setDeleteTarget({ id, name })
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return

    setActionError('')
    setDeleting(true)
    try {
      const response = await fetch(`/api/artworks/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchArtworks()
        setDeleteTarget(null)
      } else {
        setActionError('Failed to delete artwork')
      }
    } catch (error) {
      console.error('Delete error:', error)
      setActionError('Failed to delete artwork')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, fetchArtworks])

  const handleUnlinkClick = useCallback(
    (exhibitionArtworkId: string, artworkName: string, exhibitionTitle: string) => {
      setActionError('')
      setUnlinkTarget({ exhibitionArtworkId, artworkName, exhibitionTitle })
    },
    [],
  )

  const handleUnlinkConfirm = useCallback(async () => {
    if (!unlinkTarget) return

    setActionError('')
    setUnlinking(true)
    try {
      const response = await fetch(`/api/exhibition-artworks/${unlinkTarget.exhibitionArtworkId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchArtworks()
        setUnlinkTarget(null)
      } else {
        setActionError('Failed to remove from exhibition')
      }
    } catch (error) {
      console.error('Unlink error:', error)
      setActionError('Failed to remove from exhibition')
    } finally {
      setUnlinking(false)
    }
  }, [unlinkTarget, fetchArtworks])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Reorder within the VISIBLE list — which may be a single media type's
    // subset when a filter is active.
    const visible = sortedArtworks
    const oldIndex = visible.findIndex((a) => a.id === active.id)
    const newIndex = visible.findIndex((a) => a.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newVisible = arrayMove(visible, oldIndex, newIndex)

    // Slot preservation: rebuild the full library order. The visible items take
    // their new order in the slots they already occupied; every other item
    // (other media types, hidden shapes) stays exactly where it is. So
    // reordering the images alone leaves text/sound/video untouched, and the
    // new order still reads correctly on the All tab.
    const visibleIds = new Set(visible.map((a) => a.id))
    let vi = 0
    const next = artworks.map((a) => (visibleIds.has(a.id) ? newVisible[vi++] : a))

    setArtworks(next)

    try {
      await fetch('/api/artworks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkIds: next.map((a) => a.id) }),
      })
    } catch (error) {
      console.error('Error reordering artworks:', error)
      // Refetch to restore server state on error.
      fetchArtworks()
    }
  }

  if (loading) {
    return <DashboardLayout backLink="/dashboard">Loading...</DashboardLayout>
  }

  return (
    <DashboardLayout backLink="/dashboard">
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>Artwork Library</h1>

      {/* Filter Tags */}
      <div className={styles.filterBar}>
        <div className={styles.filters}>
          <Button
            variant="pill"
            onClick={() => setTypeFilter('all')}
            aria-pressed={typeFilter === 'all'}
            label="All"
          />
          <Button
            variant="pill"
            onClick={() => setTypeFilter('image')}
            aria-pressed={typeFilter === 'image'}
            label="Image"
          />
          <Button
            variant="pill"
            onClick={() => setTypeFilter('text')}
            aria-pressed={typeFilter === 'text'}
            label="Text"
          />
          <Button
            variant="pill"
            onClick={() => setTypeFilter('sound')}
            aria-pressed={typeFilter === 'sound'}
            label="Sound"
          />
          <Button
            variant="pill"
            onClick={() => setTypeFilter('video')}
            aria-pressed={typeFilter === 'video'}
            label="Video"
          />
        </div>
        <div className={styles.searchRow}>
          <Input
            id="artwork-search"
            type="text"
            variant="search"
            placeholder="Search by title or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button
            font="dashboard"
            variant="primary"
            label="Add Artwork"
            onClick={() => setShowAddModal(true)}
          />
        </div>
      </div>

      {sortedArtworks.length === 0 ? (
        <div className={styles.empty}>
          <Text font="dashboard" as="p">
            {artworks.length === 0
              ? 'No artworks yet. Click "Add Artwork" to create your first one.'
              : 'No artworks match this filter.'}
          </Text>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortedArtworks.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={styles.list}>
              {sortedArtworks.map((artwork) => (
                <SortableArtworkCard
                  key={artwork.id}
                  artwork={artwork}
                  onEdit={(id: string) => router.push(`/dashboard/artworks/${id}/edit`)}
                  onDelete={handleDeleteClick}
                  onUnlink={handleUnlinkClick}
                  playingArtworkId={playingArtworkId}
                  onTogglePlay={handleTogglePlay}
                  draggable={dragEnabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <AddArtworkModal
            userId={effectiveUser?.id ?? ''}
            onClose={() => setShowAddModal(false)}
            onSuccess={handleAddSuccess}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className={styles.deleteModal}>
            <Text font="dashboard" as="h2">
              Delete Artwork?
            </Text>
            <Text font="dashboard" as="p">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              <br />
              This action cannot be undone.
            </Text>
            <ErrorText>{actionError}</ErrorText>
            <div className={styles.deleteActions}>
              <Button
                variant="primary"
                label={deleting ? 'Deleting...' : 'Yes, Delete'}
                onClick={handleDeleteConfirm}
              />
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => setDeleteTarget(null)}
              />
            </div>
          </div>
        </Modal>
      )}

      {unlinkTarget && (
        <Modal onClose={() => setUnlinkTarget(null)}>
          <div className={styles.deleteModal}>
            <Text font="dashboard" as="h2">
              Remove from Exhibition?
            </Text>
            <Text font="dashboard" as="p">
              Remove <strong>{unlinkTarget.artworkName}</strong> from{' '}
              <strong>{unlinkTarget.exhibitionTitle}</strong>?
              <br />
              The artwork will remain in your library.
            </Text>
            <ErrorText>{actionError}</ErrorText>
            <div className={styles.deleteActions}>
              <Button
                variant="primary"
                label={unlinking ? 'Removing...' : 'Yes, Remove'}
                onClick={handleUnlinkConfirm}
              />
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => setUnlinkTarget(null)}
              />
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  )
}
