import c from 'classnames'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'

import { Button } from '@/components/ui/Button'
import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { showEditMode } from '@/lib/features/dashboardSlice'
import { showGrid, hideGrid, showPerson, hidePerson } from '@/lib/features/wallViewSlice'
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
  const isGridVisible = useSelector((state) => state.wallView.isGridVisible)
  const isPersonVisible = useSelector((state) => state.wallView.isPersonVisible)

  const wallArtworks = artworks.filter((artwork) => artwork.wallId === currentWallId).reverse()

  const handleZoomIn = () => {
    dispatch(increaseScaleFactor())
  }

  const handleZoomOut = () => {
    dispatch(decreaseScaleFactor())
  }

  const handleResetView = () => {
    dispatch(resetPan())
  }

  const handleSaveWallView = () => {
    dispatch(hideGrid())
    dispatch(hidePerson())
    dispatch(hideWallView())
    dispatch(showEditMode())
  }

  const handleToggleGrid = () => {
    if (isGridVisible) {
      dispatch(hideGrid())
    } else {
      dispatch(showGrid())
    }
  }

  const handleTogglePerson = () => {
    if (isPersonVisible) {
      dispatch(hidePerson())
    } else {
      dispatch(showPerson())
    }
  }

  const handleSelectArtwork = (artworkId) => {
    dispatch(chooseCurrentArtworkId(artworkId))
    if (!isWizardOpen) {
      dispatch(showWizard())
    }
  }

  useEffect(() => {
    const handleWheelZoom = (event) => {
      if (event.metaKey) {
        event.preventDefault()
        if (event.deltaY < 0) {
          dispatch(increaseScaleFactor())
        } else if (event.deltaY > 0) {
          dispatch(decreaseScaleFactor())
        }
      }
    }

    window.addEventListener('wheel', handleWheelZoom)

    return () => {
      window.removeEventListener('wheel', handleWheelZoom)
    }
  }, [])

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.item}>
              <Button type="small" onClick={handleSaveWallView} label="Save" />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <h2 className={styles.title}>Helpers</h2>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="zoomOut" onClick={handleZoomOut} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="zoomIn" onClick={handleZoomIn} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="reset" onClick={handleResetView} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="grid" onClick={handleToggleGrid} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="person" onClick={handleTogglePerson} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="person" onClick={handleTogglePerson} />
            </div>
          </div>
        </div>
      </div>
      {wallArtworks.length > 0 && (
        <div className={styles.section}>
          <div className={styles.subsection}>
            <ul className={styles.artworks}>
              {wallArtworks.map((artwork) => (
                <li
                  key={artwork.id}
                  onClick={() => handleSelectArtwork(artwork.id)}
                  className={c(styles.artwork, {
                    [styles.selected]: artwork.id === currentArtworkId,
                  })}
                  style={{ cursor: 'pointer' }}
                >
                  {artwork.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeftPanel
