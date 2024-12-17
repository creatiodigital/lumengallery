import c from 'classnames'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { showEditMode } from '@/lib/features/dashboardSlice'
import {
  increaseScaleFactor,
  decreaseScaleFactor,
  resetPan,
  hideWallView,
  chooseCurrentArtworkId,
} from '@/lib/features/wallViewSlice'
import { showWizard } from '@/lib/features/wizardSlice'

import styles from './LeftPanel.module.scss'

export const LeftPanel = () => {
  const dispatch = useDispatch()

  // Get artworks, current wall ID, and current artwork ID from the store
  const artworks = useSelector((state) => state.artist.artworks)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)

  // Filter artworks by the current wall ID
  const wallArtworks = artworks.filter((artwork) => artwork.wallId === currentWallId)

  const handleZoomIn = () => {
    dispatch(increaseScaleFactor())
  }

  const handleZoomOut = () => {
    dispatch(decreaseScaleFactor())
  }

  const handleResetPan = () => {
    dispatch(resetPan())
  }

  const handleSaveWallView = () => {
    dispatch(hideWallView())
    dispatch(showEditMode())
  }

  const handleSelectArtwork = (artworkId) => {
    dispatch(chooseCurrentArtworkId(artworkId))
    if (!isWizardOpen) {
      dispatch(showWizard())
    }
  }

  return (
    <div className={styles.leftPanel}>
      <div className={styles.ctas}>
        <Button type="small" onClick={handleSaveWallView} label="Save" />
        <Button type="small" onClick={handleSaveWallView} label="+" />
        <Button type="small" onClick={handleSaveWallView} label="-" />
        <Button type="small" onClick={handleSaveWallView} label="Reset" />
      </div>
      <ul className={styles.artworks}>
        {wallArtworks.map((artwork) => (
          <li
            key={artwork.id}
            onClick={() => handleSelectArtwork(artwork.id)} // Select the artwork when clicked
            className={c(styles.artwork, {
              [styles.selected]: artwork.id === currentArtworkId,
            })}
            style={{ cursor: 'pointer' }}
          >
            {artwork.name} {/* Display the artwork name */}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default LeftPanel
