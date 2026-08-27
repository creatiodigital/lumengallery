'use client'

import { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { X } from 'lucide-react'

import {
  ArtworkDetailBody,
  type Artwork,
  type Artist,
  type ArtworkCommerce,
} from '@/components/artwork/detail/ArtworkDetailBody'
import { ArtworkMediaGallery } from '@/components/artwork/detail/ArtworkMediaGallery'
import { ArtworkStorySection } from '@/components/artwork/detail/ArtworkStorySection'
import type { ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'
import { Button } from '@/components/ui/Button'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { closeArtworkModal } from '@/redux/slices/dashboardSlice'
import type { RootState } from '@/redux/store'

import { mapReduxArtwork } from './mapReduxArtwork'
import styles from './ArtworkModal.module.scss'

type FetchedDetail = {
  artwork: Partial<Artwork>
  artist: Artist
  /** Resolved server-side, exactly as the artwork page builds it, so the modal
   *  shows the same availability card rather than a reduced twin. */
  commerce: ArtworkCommerce | null
  media: ArtworkMediaItem[]
}

export const ArtworkModal = () => {
  const dispatch = useDispatch()
  const isMobile = useIsMobile()
  const currentArtworkId = useSelector((state: RootState) => state.scene.currentArtworkId)
  const reduxArtwork = useSelector((state: RootState) =>
    currentArtworkId ? state.artworks.byId[currentArtworkId] : null,
  )
  const slug = reduxArtwork?.slug
  const [fetched, setFetched] = useState<FetchedDetail | null>(null)

  // Backfill the fields the scene doesn't hold (description, print, dims, full artist).
  useEffect(() => {
    if (!slug) return
    let canceled = false
    setFetched(null)
    fetch(`/api/artworks/by-slug/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: FetchedDetail | null) => {
        if (!canceled && data) setFetched(data)
      })
      .catch(() => {})
    return () => {
      canceled = true
    }
  }, [slug])

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(closeArtworkModal())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (isMobile || !reduxArtwork) return null

  const base = mapReduxArtwork(reduxArtwork)
  const artwork: Artwork = { ...base.artwork, ...(fetched?.artwork ?? {}) }
  const artist: Artist = fetched?.artist ?? base.artist

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Artwork detail"
      // Marks this overlay so the 3D scene's global wheel handler ignores wheel events
      // here (see MainCamera onWheel) — lets the modal content and the InquireSidebar
      // inside it scroll independently instead of the scene swallowing the scroll.
      data-panel-overlay
    >
      <Button
        variant="ghost"
        className={styles.close}
        onClick={() => dispatch(closeArtworkModal())}
        aria-label="Close artwork"
      >
        <X size={20} strokeWidth={ICON_STROKE_WIDTH} />
      </Button>
      {/* Mirrors the standalone artwork page section for section: the
          two-column zone, then the story, then the imagery. `layout="page"` is
          what moves the description out of the metadata column and into its own
          full-width section, exactly as it does there. */}
      <div className={styles.content}>
        <div className={styles.body}>
          <ArtworkDetailBody
            artwork={artwork}
            artist={artist}
            commerce={fetched?.commerce}
            layout="page"
          />
        </div>

        <ArtworkStorySection description={artwork.description} />

        <ArtworkMediaGallery media={fetched?.media ?? []} />
      </div>
    </div>
  )
}

export default ArtworkModal
