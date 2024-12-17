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

  const artworks = useSelector((state) => state.artist.artworks)
  const currentWallId = useSelector((state) => state.wallView.currentWallId)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)

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
    <div className={styles.panel}>
      <div className={styles.section}>
        <h2 className={styles.title}>View</h2>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.item}>
              <Button type="small" onClick={handleSaveWallView} label="Save" />
            </div>
            <div className={styles.item}>
              <Button type="small" onClick={handleResetPan} label="Reset" />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.item}>
              <Button type="small" onClick={handleZoomIn} label="+" />
            </div>
            <div className={styles.item}>
              <Button type="small" onClick={handleZoomOut} label="-" />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.title}>Pictures</h2>
        <div className={styles.subsection}>
          {wallArtworks.length > 0 && (
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
          )}
        </div>
      </div>
    </div>
  )
}

export default LeftPanel
