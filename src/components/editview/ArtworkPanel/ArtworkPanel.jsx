import React, { useRef, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { hideArtworkPanel } from '@/lib/features/dashboardSlice'

import styles from './ArtworkPanel.module.scss'

const ArtworkPanel = () => {
  const dispatch = useDispatch()
  const panelRef = useRef(null) // Reference for the panel
  const artworks = useSelector((state) => state.artist.artworks)
  const selectedSceneArtworkId = useSelector((state) => state.scene.currentArtworkId)

  const selectedArtwork = useMemo(
    () => artworks.find((artwork) => artwork.id === selectedSceneArtworkId),
    [artworks, selectedSceneArtworkId],
  )

  const { name, artworkTitle, author, year, description, artworkDimensions } = selectedArtwork || {}

  // Close panel when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        dispatch(hideArtworkPanel())
      }
    }

    document.addEventListener('mousedown', handleClickOutside) // Add listener

    return () => {
      document.removeEventListener('mousedown', handleClickOutside) // Clean up listener
    }
  }, [dispatch])

  return (
    <div ref={panelRef} className={styles.artworkPanel}>
      <div className={styles.info}>
        {selectedArtwork && (
          <div>
            {author && <h3 className={styles.author}>{author}</h3>}
            {(artworkTitle || name) && <span className={styles.title}>{artworkTitle || name}</span>}
            {year && <span className={styles.year}>{`, ${year}`}</span>}
            {description && <div className={styles.description}>{description}</div>}
            {artworkDimensions && <span className={styles.dimensions}>{artworkDimensions}</span>}
          </div>
        )}
      </div>
      <div className={styles.cta}>
        <Button type="outline" label="Close" onClick={() => dispatch(hideArtworkPanel())} />
      </div>
    </div>
  )
}

export default ArtworkPanel
