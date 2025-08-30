import c from 'classnames'
import React from 'react'
import { useState, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { Input } from '@/components/ui/Input'
import { editArtwork } from '@/redux/slices/artworksSlice'
import { showEditMode } from '@/redux/slices/dashboardSlice'
import { editWallName } from '@/redux/slices/sceneSlice'
import { showHuman, hideHuman, removeGroup } from '@/redux/slices/wallViewSlice'
import {
  increaseScaleFactor,
  decreaseScaleFactor,
  resetPan,
  hideWallView,
  chooseCurrentArtworkId,
} from '@/redux/slices/wallViewSlice'
import { showWizard } from '@/redux/slices/wizardSlice'
import type { RootState } from '@/redux/store'

import styles from './LeftPanel.module.scss'

export const LeftPanel = () => {
  const dispatch = useDispatch()

  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const allIds = useSelector((state: RootState) => state.artworks.allIds)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const walls = useSelector((state: RootState) => state.scene.walls)
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const isWizardOpen = useSelector((state: RootState) => state.wizard.isWizardOpen)
  const isHumanVisible = useSelector((state: RootState) => state.wallView.isHumanVisible)

  const [isWallNameEditing, setIsWallNameEditing] = useState(false)
  const [newWallName, setNewWallName] = useState('')

  const [isEditingArtwork, setIsEditingArtwork] = useState<string | null>(null)
  const [newArtworkName, setNewArtworkName] = useState('')

  const currentWall = walls.find((wall) => wall.id === currentWallId)
  const currentWallName = currentWall ? currentWall.name : 'Select a wall'

  const wallArtworks = useMemo(
    () =>
      allIds
        .map((id) => artworksById[id])
        .filter((artwork) => artwork.wallId === currentWallId)
        .reverse(),
    [allIds, artworksById, currentWallId],
  )

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
    dispatch(hideHuman())
    dispatch(hideWallView())
    dispatch(showEditMode())
    dispatch(chooseCurrentArtworkId(null))
    dispatch(removeGroup())
  }

  const handleToggleHuman = () => {
    if (isHumanVisible) {
      dispatch(hideHuman())
    } else {
      dispatch(showHuman())
    }
  }

  const handleSelectArtwork = (artworkId: string | null) => {
    if (currentArtworkId !== artworkId) {
      dispatch(chooseCurrentArtworkId(artworkId))
    }
    if (!isWizardOpen) {
      dispatch(showWizard())
    }
  }

  const handleDoubleClick = () => {
    if (currentWall) {
      setNewWallName(currentWall.name)
      setIsWallNameEditing(true)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewWallName(e.target.value)
  }

  const handleBlur = () => {
    if (currentWall && newWallName.trim() !== '') {
      dispatch(editWallName({ wallId: currentWallId!, newName: newWallName.trim() }))
    }
    setIsWallNameEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    } else if (e.key === 'Escape') {
      setIsWallNameEditing(false)
    }
  }

  const handleDoubleClickArtwork = (artworkId: string, currentName: string) => {
    setNewArtworkName(currentName)
    setIsEditingArtwork(artworkId)
  }

  const handleChangeArtworkName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewArtworkName(e.target.value)
  }

  const handleBlurArtworkName = (artworkId: string) => {
    if (newArtworkName.trim() !== '') {
      dispatch(
        editArtwork({
          currentArtworkId: artworkId,
          property: 'name',
          value: newArtworkName.trim(),
        }),
      )
    }
    setIsEditingArtwork(null)
  }

  const handleKeyDownArtworkName = (e: React.KeyboardEvent, artworkId: string) => {
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
              <Button variant="small" onClick={handleSaveWallView} label="Save" />
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
              <ButtonIcon icon="person" onClick={handleToggleHuman} />
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
