import c from 'classnames'
import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { Input } from '@/components/ui/Input'
import { editWallName, editArtworkName } from '@/lib/features/artistSlice'
import { showEditMode } from '@/lib/features/dashboardSlice'
import { showPerson, hidePerson } from '@/lib/features/wallViewSlice'
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
  const walls = useSelector((state) => state.artist.walls)
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const isWizardOpen = useSelector((state) => state.wizard.isWizardOpen)
  const isPersonVisible = useSelector((state) => state.wallView.isPersonVisible)

  const [isWallNameEditing, setisWallNameEditing] = useState(false)
  const [newWallName, setNewWallName] = useState('')

  const [isEditingArtwork, setIsEditingArtwork] = useState(null) // Track editing artwork ID
  const [newArtworkName, setNewArtworkName] = useState('')

  const currentWall = walls.find((wall) => wall.id === currentWallId)
  const currentWallName = currentWall ? currentWall.name : 'Select a wall'

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
    dispatch(hidePerson())
    dispatch(hideWallView())
    dispatch(showEditMode())
    dispatch(chooseCurrentArtworkId(null))
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

  const handleDoubleClick = () => {
    if (currentWall) {
      setNewWallName(currentWall.name)
      setisWallNameEditing(true)
    }
  }

  const handleChange = (e) => {
    setNewWallName(e.target.value)
  }

  const handleBlur = () => {
    if (currentWall && newWallName.trim() !== '') {
      dispatch(editWallName({ wallId: currentWallId, newName: newWallName.trim() }))
    }
    setisWallNameEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBlur()
    } else if (e.key === 'Escape') {
      setisWallNameEditing(false)
    }
  }

  const handleDoubleClickArtwork = (artworkId, currentName) => {
    setNewArtworkName(currentName)
    setIsEditingArtwork(artworkId)
  }

  const handleChangeArtworkName = (e) => {
    setNewArtworkName(e.target.value)
  }

  const handleBlurArtworkName = (artworkId) => {
    if (newArtworkName.trim() !== '') {
      dispatch(editArtworkName({ currentArtworkId: artworkId, name: newArtworkName.trim() }))
    }
    setIsEditingArtwork(null)
  }

  const handleKeyDownArtworkName = (e, artworkId) => {
    if (e.key === 'Enter') {
      handleBlurArtworkName(artworkId)
    } else if (e.key === 'Escape') {
      setIsEditingArtwork(null)
    }
  }

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
              <ButtonIcon icon="person" onClick={handleTogglePerson} />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        {isWallNameEditing ? (
          <Input
            value={newWallName}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <h1
            className={styles.wallTitle}
            onDoubleClick={handleDoubleClick}
            style={{ cursor: currentWall ? 'pointer' : 'default' }}
          >
            {currentWallName}
          </h1>
        )}
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
                  {isEditingArtwork === artwork.id ? (
                    <Input
                      value={newArtworkName}
                      onChange={handleChangeArtworkName}
                      onBlur={() => handleBlurArtworkName(artwork.id)}
                      onKeyDown={(e) => handleKeyDownArtworkName(e, artwork.id)}
                      autoFocus
                    />
                  ) : (
                    <span
                      onDoubleClick={() => handleDoubleClickArtwork(artwork.id, artwork.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      {artwork.name}
                    </span>
                  )}
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
