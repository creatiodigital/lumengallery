import React from 'react'
import { useSelector } from 'react-redux'

import { Checkbox } from '@/components/ui/Checkbox'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkImageHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkImageHandlers'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'

import { frameThicknessOptions, passepartoutThicknessOptions } from './constants'

const ArtisticImage = () => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const {
    artworkTitle,
    description,
    author,
    artworkYear,
    artworkDimensions,
    showFrame,
    showArtworkInformation,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutThickness,
    frameColor,
    frameThickness,
  } = useArtworkDetails(currentArtworkId!)

  const { handleEditArtwork, handleEditArtisticImage } = useArtworkImageHandlers(currentArtworkId!)

  return (
    <>
      {imageUrl && (
        <>
          <div className={styles.subsection}>
            <div className={styles.row}>
              <div className={styles.item}>
                <Checkbox
                  checked={showArtworkInformation!}
                  onChange={(e) =>
                    handleEditArtisticImage('showArtworkInformation', e.target.checked)
                  }
                  label="Display Information"
                />
              </div>
            </div>
          </div>

          {showArtworkInformation && (
            <div className={styles.section}>
              <div className={styles.subsection}>
                <div className={styles.row}>
                  <div className={styles.item}>
                    <span className={styles.label}>Author</span>
                    <Input
                      value={author!}
                      onChange={(e) => handleEditArtwork('author', e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.item}>
                    <span className={styles.label}>Title</span>
                    <Input
                      value={artworkTitle!}
                      onChange={(e) => handleEditArtwork('artworkTitle', e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.item}>
                    <span className={styles.label}>Year</span>
                    <Input
                      value={artworkYear!}
                      onChange={(e) => handleEditArtwork('artworkYear', e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.item}>
                    <span className={styles.label}>Description</span>
                    <Textarea
                      value={description!}
                      onChange={(e) => handleEditArtwork('description', e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.item}>
                    <span className={styles.label}>Dimensions</span>
                    <Input
                      value={artworkDimensions!}
                      onChange={(e) => handleEditArtwork('artworkDimensions', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={styles.section}>
            <h2 className={styles.title}>Features</h2>

            <div className={styles.subsection}>
              <div className={styles.row}>
                <div className={styles.item}>
                  <Checkbox
                    checked={showFrame!}
                    onChange={(e) => handleEditArtisticImage('showFrame', e.target.checked)}
                    label="Add Frame"
                  />
                </div>
              </div>

              {showFrame && (
                <div className={styles.row}>
                  <div className={styles.item}>
                    <span className={styles.label}>Color</span>
                    <ColorPicker
                      textColor={frameColor!}
                      onColorSelect={(value) => handleEditArtisticImage('frameColor', value)}
                    />
                  </div>
                  <div className={styles.item}>
                    <span className={styles.label}>Thickness</span>
                    <Select
                      options={frameThicknessOptions}
                      onSelect={(value) => handleEditArtisticImage('frameThickness', value)}
                      selectedLabel={frameThickness}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={styles.subsection}>
              <div className={styles.row}>
                <div className={styles.item}>
                  <Checkbox
                    checked={showPassepartout!}
                    onChange={(e) => handleEditArtisticImage('showPassepartout', e.target.checked)}
                    label="Add Passepartout"
                  />
                </div>
              </div>

              {showPassepartout && (
                <div className={styles.row}>
                  <div className={styles.item}>
                    <span className={styles.label}>Color</span>
                    <ColorPicker
                      textColor={passepartoutColor!}
                      onColorSelect={(value) => handleEditArtisticImage('passepartoutColor', value)}
                    />
                  </div>
                  <div className={styles.item}>
                    <span className={styles.label}>Thickness</span>
                    <Select
                      options={passepartoutThicknessOptions}
                      onSelect={(value) => handleEditArtisticImage('passepartoutThickness', value)}
                      selectedLabel={passepartoutThickness}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default ArtisticImage
