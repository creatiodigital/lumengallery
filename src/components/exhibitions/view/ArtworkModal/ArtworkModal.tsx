'use client'

import { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { X } from 'lucide-react'

import { ArtworkDetailBody, type Artwork, type Artist } from '@/components/artwork/detail/ArtworkDetailBody'
import { Button } from '@/components/ui/Button'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { closeArtworkModal } from '@/redux/slices/dashboardSlice'
import type { RootState } from '@/redux/store'

import { mapReduxArtwork } from './mapReduxArtwork'
import styles from './ArtworkModal.module.scss'

type FetchedDetail = { artwork: Partial<Artwork>; artist: Artist }

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
    let cancelled = false
    setFetched(null)
    fetch(`/api/artworks/by-slug/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: FetchedDetail | null) => {
        if (!cancelled && data) setFetched(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
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
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Artwork detail">
      <Button
        variant="ghost"
        className={styles.close}
        onClick={() => dispatch(closeArtworkModal())}
        aria-label="Close artwork"
      >
        <X size={20} strokeWidth={ICON_STROKE_WIDTH} />
      </Button>
      <div className={styles.body}>
        <ArtworkDetailBody artwork={artwork} artist={artist} />
      </div>
    </div>
  )
}

export default ArtworkModal
