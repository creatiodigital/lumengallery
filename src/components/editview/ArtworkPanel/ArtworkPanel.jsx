import React, { useRef, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { hideArtworkPanel } from '@/redux/slices/dashboardSlice'

import styles from './ArtworkPanel.module.scss'

const ArtworkPanel = () => {
  const dispatch = useDispatch()
  const panelRef = useRef(null)
  const selectedSceneArtworkId = useSelector((state) => state.scene.currentArtworkId)
  const byId = useSelector((state) => state.artworks.byId)

  const selectedArtwork = useMemo(
    () => byId[selectedSceneArtworkId],
    [byId, selectedSceneArtworkId],
  )

  const { name, artworkTitle, author, artworkYear, description, artworkDimensions } =
    selectedArtwork || {}

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.cta}>
        <Button type="outline" label="Close" onClick={() => dispatch(hideArtworkPanel())} />
      </div>
      <div className={styles.info}>
        {selectedArtwork && (
          <div>
            {author && <h3 className={styles.author}>{author}</h3>}
            {(artworkTitle || name) && <span className={styles.title}>{artworkTitle || name}</span>}
            {artworkYear && <span className={styles.year}>{`, ${artworkYear}`}</span>}
            {description && <div className={styles.description}>{description}</div>}
            {artworkDimensions && <span className={styles.dimensions}>{artworkDimensions}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export default ArtworkPanel
