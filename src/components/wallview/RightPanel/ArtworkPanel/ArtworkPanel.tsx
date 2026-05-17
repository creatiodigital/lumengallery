'use client'

import { useEffect, useState } from 'react'

import { WALL_SCALE } from '@/components/wallview/constants'
import { useGLTF } from '@react-three/drei'

import { useSelector, useDispatch } from 'react-redux'
import { Mesh } from 'three'

import { Button } from '@/components/ui/Button'
import { Section } from '@/components/ui/Section/Section'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import { Slider } from '@/components/ui/Slider'
import { Text } from '@/components/ui/Typography'
import { spaceConfigs, type SpaceKey } from '@/components/scene/constants'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { cmEventToMeters } from '@/components/wallview/utils'
import { getOriginalDimensions, hasPendingUpload } from '@/lib/pendingUploads'
import { getPrintMaxSize } from '@/lib/print-providers/printspace/sizeBounds'
import { updateArtworkPosition, toggleArtworkLocked } from '@/redux/slices/exhibitionSlice'
import { setSizeLocked } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TAlign } from '@/types/wizard'

import { useArtworkDetails } from '../hooks/useArtworkDetails'
import { useArtworkHandlers } from '../hooks/useArtworkHandlers'
import styles from '../RightPanel.module.scss'

const ArtworkPanel = () => {
  const dispatch = useDispatch()
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const sizeLocked = useSelector((state: RootState) =>
    currentArtworkId ? (state.wallView.sizeLockedById[currentArtworkId] ?? false) : false,
  )

  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const gltfPath =
    spaceConfigs[spaceId || 'paris']?.gltfPath || '/assets/spaces/paris/paris10.glb?v=2'
  const { nodes } = useGLTF(gltfPath) as unknown as {
    nodes: Record<string, Mesh>
  }
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  // Get artwork data to check if it has an uploaded image
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const artwork = currentArtworkId ? artworksById[currentArtworkId] : null
  const exhibitionArtwork = currentArtworkId ? exhibitionArtworksById[currentArtworkId] : null
  const isLocked = exhibitionArtwork?.locked ?? false

  const { width, height, fromTop, fromBottom, fromLeft, fromRight } = useArtworkDetails(
    currentArtworkId!,
  )
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)

  const widthCm = Math.round((width / WALL_SCALE) * 100)
  const heightCm = Math.round((height / WALL_SCALE) * 100)

  // Local input strings so partial typing is allowed without snapping
  // back to the formatted Redux value mid-edit.
  const [widthInputStr, setWidthInputStr] = useState(String(widthCm))
  const [heightInputStr, setHeightInputStr] = useState(String(heightCm))
  const [widthFocused, setWidthFocused] = useState(false)
  const [heightFocused, setHeightFocused] = useState(false)

  useEffect(() => {
    if (!widthFocused) setWidthInputStr(String(widthCm))
  }, [widthCm, widthFocused])
  useEffect(() => {
    if (!heightFocused) setHeightInputStr(String(heightCm))
  }, [heightCm, heightFocused])

  const {
    handleAlignChange,
    handleFromTopChange,
    handleFromBottomChange,
    handleFromLeftChange,
    handleFromRightChange,
    handleWidthChange,
    handleHeightChange,
  } = useArtworkHandlers(currentArtworkId!, boundingData!)

  const handleAlign = (alignment: TAlign) => {
    handleAlignChange(alignment, wallWidth!, wallHeight!)
  }

  // Check if we can show the "Use image proportions" button
  // Show for any image artwork that has either a pending upload or an existing imageUrl
  const hasPendingImage = currentArtworkId ? hasPendingUpload(currentArtworkId) : false
  const hasExistingImage = artwork?.artworkType === 'image' && artwork?.imageUrl
  const showProportionsButton =
    artwork?.artworkType === 'image' && (hasPendingImage || hasExistingImage)

  const handleUseImageProportions = async () => {
    if (!currentArtworkId || !exhibitionArtwork) return

    let originalWidth: number
    let originalHeight: number

    // Priority 1: Get dimensions from pending upload (freshly dropped)
    const pendingDimensions = getOriginalDimensions(currentArtworkId)
    if (pendingDimensions) {
      originalWidth = pendingDimensions.width
      originalHeight = pendingDimensions.height
    }
    // Priority 2: Get dimensions from artwork data (stored in DB)
    else if (artwork?.originalWidth && artwork?.originalHeight) {
      originalWidth = artwork.originalWidth
      originalHeight = artwork.originalHeight
    }
    // Priority 3: Load dynamically from image URL as fallback
    else if (artwork?.imageUrl) {
      try {
        const img = new Image()
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load image'))
          img.src = artwork.imageUrl!
        })
        originalWidth = img.naturalWidth
        originalHeight = img.naturalHeight
      } catch {
        console.error('Failed to load image dimensions')
        return
      }
    } else {
      return
    }

    const originalRatio = originalWidth / originalHeight

    const currentWidth = exhibitionArtwork.width2d
    const currentHeight = exhibitionArtwork.height2d

    let newWidth: number
    let newHeight: number

    // Keep the larger dimension, adjust the smaller one
    if (currentWidth >= currentHeight) {
      newWidth = currentWidth
      newHeight = currentWidth / originalRatio
    } else {
      newHeight = currentHeight
      newWidth = currentHeight * originalRatio
    }

    // Update both width and height
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: {
          width2d: newWidth,
          height2d: newHeight,
        },
      }),
    )
  }

  // Proportional resize handlers (when Lock size is checked)
  const handleLockedWidthChange = (newWidthMeters: number) => {
    if (!sizeLocked || !currentArtworkId || !exhibitionArtwork) {
      handleWidthChange(newWidthMeters)
      return
    }

    const currentRatio = width / height
    const newWidth2d = newWidthMeters * WALL_SCALE
    const newHeight2d = newWidth2d / currentRatio

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: {
          width2d: newWidth2d,
          height2d: newHeight2d,
        },
      }),
    )
  }

  const handleLockedHeightChange = (newHeightMeters: number) => {
    if (!sizeLocked || !currentArtworkId || !exhibitionArtwork) {
      handleHeightChange(newHeightMeters)
      return
    }

    const currentRatio = width / height
    const newHeight2d = newHeightMeters * WALL_SCALE
    const newWidth2d = newHeight2d * currentRatio

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: {
          width2d: newWidth2d,
          height2d: newHeight2d,
        },
      }),
    )
  }

  return (
    <>
      {/* HEADER Section */}
      <div className={styles.header}>
        <Text font="dashboard" as="h2" size="sm" weight="bold" className={styles.headerTitle}>
          {artwork?.name || 'Artwork'}
        </Text>
      </div>

      {/* INTERACTION Section */}
      <Section title="Interaction">
        <Checkbox
          checked={isLocked}
          onChange={() =>
            currentArtworkId && dispatch(toggleArtworkLocked({ artworkId: currentArtworkId }))
          }
          label="Lock artwork"
        />
      </Section>

      {/* SIZE Section */}
      <Section title="Dimensions" disabled={isLocked}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Size (cm)
        </Text>
        {(() => {
          const maxWidthCm = Math.max(500, widthCm)
          const maxHeightCm = Math.max(500, heightCm)
          const minCm = 10
          // Handlers still work in meters; convert cm → m at the edge.
          const commitFromString = (raw: string, commit: (v: number) => void) => {
            const parsed = parseFloat(raw.replace(',', '.'))
            if (Number.isFinite(parsed) && parsed >= minCm) commit(parsed / 100)
          }

          // Print-max marker — image artworks with known resolution
          // only. Shows the largest size a buyer can actually order so
          // the artist doesn't display a wall artwork bigger than
          // anything on sale. Hidden when resolution is missing so a
          // placeholder value never reads as a real cap.
          const isImage = artwork?.artworkType === 'image'
          let imageMeta: { width: number; height: number } | null = null
          if (isImage && currentArtworkId) {
            const pending = getOriginalDimensions(currentArtworkId)
            if (pending) imageMeta = pending
            else if (artwork?.originalWidth && artwork?.originalHeight) {
              imageMeta = { width: artwork.originalWidth, height: artwork.originalHeight }
            }
          }
          const printMax = imageMeta ? getPrintMaxSize(imageMeta) : null
          const markerPct = (valCm: number, max: number) =>
            ((Math.min(max, Math.max(minCm, valCm)) - minCm) / (max - minCm)) * 100
          const widthMarker = printMax ? markerPct(printMax.widthCm, maxWidthCm) : null
          const heightMarker = printMax ? markerPct(printMax.heightCm, maxHeightCm) : null

          return (
            <>
              <div className={styles.item}>
                <label className={styles.sizeField}>
                  <Text font="dashboard" as="span" size="xs" className={styles.label}>
                    Width (cm)
                  </Text>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={widthInputStr}
                    onChange={(e) => {
                      setWidthInputStr(e.target.value)
                      commitFromString(e.target.value, handleLockedWidthChange)
                    }}
                    onFocus={() => setWidthFocused(true)}
                    onBlur={() => {
                      setWidthFocused(false)
                      setWidthInputStr(String(widthCm))
                    }}
                    disabled={isLocked}
                    aria-label="Artwork width in centimeters"
                  />
                </label>
                <div className={styles.sliderWithMarker}>
                  <Slider
                    min={minCm}
                    max={maxWidthCm}
                    step={1}
                    value={widthCm}
                    onChange={(cm) => handleLockedWidthChange(cm / 100)}
                    disabled={isLocked}
                    aria-label="Artwork width in centimeters"
                  />
                  {widthMarker !== null && (
                    <div className={styles.markerTrack}>
                      <span
                        className={styles.maxPrintMarker}
                        style={{ left: `${widthMarker}%` }}
                        aria-hidden
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.item}>
                <label className={styles.sizeField}>
                  <Text font="dashboard" as="span" size="xs" className={styles.label}>
                    Height (cm)
                  </Text>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={heightInputStr}
                    onChange={(e) => {
                      setHeightInputStr(e.target.value)
                      commitFromString(e.target.value, handleLockedHeightChange)
                    }}
                    onFocus={() => setHeightFocused(true)}
                    onBlur={() => {
                      setHeightFocused(false)
                      setHeightInputStr(String(heightCm))
                    }}
                    disabled={isLocked}
                    aria-label="Artwork height in centimeters"
                  />
                </label>
                <div className={styles.sliderWithMarker}>
                  <Slider
                    min={minCm}
                    max={maxHeightCm}
                    step={1}
                    value={heightCm}
                    onChange={(cm) => handleLockedHeightChange(cm / 100)}
                    disabled={isLocked}
                    aria-label="Artwork height in centimeters"
                  />
                  {heightMarker !== null && (
                    <div className={styles.markerTrack}>
                      <span
                        className={styles.maxPrintMarker}
                        style={{ left: `${heightMarker}%` }}
                        aria-hidden
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )
        })()}
        {showProportionsButton && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Button
              font="dashboard"
              fullWidth
              variant="secondary"
              label="Use image proportions"
              onClick={handleUseImageProportions}
              disabled={isLocked}
            />
          </div>
        )}
        <div style={{ marginTop: 'var(--space-3)' }} data-no-deselect="true">
          <Checkbox
            checked={sizeLocked}
            onChange={(e) =>
              currentArtworkId &&
              dispatch(setSizeLocked({ artworkId: currentArtworkId, value: e.target.checked }))
            }
            label="Lock proportions when resizing"
            disabled={isLocked}
          />
        </div>
      </Section>

      <Section title="Position" disabled={isLocked}>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionTop"
              onClick={() => handleAlign('verticalTop')}
              disabled={isLocked}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionCenterV"
              onClick={() => handleAlign('verticalCenter')}
              disabled={isLocked}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionBottom"
              onClick={() => handleAlign('verticalBottom')}
              disabled={isLocked}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionLeft"
              onClick={() => handleAlign('horizontalLeft')}
              disabled={isLocked}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionCenterH"
              onClick={() => handleAlign('horizontalCenter')}
              disabled={isLocked}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionRight"
              onClick={() => handleAlign('horizontalRight')}
              disabled={isLocked}
            />
          </div>
        </div>

        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Vertical Position (cm)
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <NumberInput
              value={Math.round((fromTop / WALL_SCALE) * 100)}
              icon="arrowTopFromLine"
              label="from top"
              min={0}
              max={100000}
              onChange={(e) => handleFromTopChange(cmEventToMeters(e))}
              disabled={isLocked}
            />
          </div>
          <div className={styles.item}>
            <NumberInput
              value={Math.round((fromBottom / WALL_SCALE) * 100)}
              icon="arrowBottomFromLine"
              label="from bottom"
              min={0}
              max={100000}
              onChange={(e) => handleFromBottomChange(cmEventToMeters(e))}
              disabled={isLocked}
            />
          </div>
        </div>

        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Horizontal Position (cm)
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <NumberInput
              value={Math.round((fromLeft / WALL_SCALE) * 100)}
              icon="arrowLeftFromLine"
              label="from left"
              min={0}
              max={100000}
              onChange={(e) => handleFromLeftChange(cmEventToMeters(e))}
              disabled={isLocked}
            />
          </div>
          <div className={styles.item}>
            <NumberInput
              value={Math.round((fromRight / WALL_SCALE) * 100)}
              icon="arrowRightFromLine"
              label="from right"
              min={0}
              max={100000}
              onChange={(e) => handleFromRightChange(cmEventToMeters(e))}
              disabled={isLocked}
            />
          </div>
        </div>

        {/* Rotation slider - shapes only */}
        {artwork?.artworkType === 'shape' && exhibitionArtwork && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <div
              className={styles.row}
              style={{ justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Text font="dashboard" as="span" size="xs" className={styles.label}>
                Rotation
              </Text>
              <Text font="dashboard" as="span" size="xs" style={{ fontFamily: 'monospace' }}>
                {Math.round(exhibitionArtwork.rotation ?? 0)}°
              </Text>
            </div>
            <Slider
              min={0}
              max={360}
              step={1}
              value={exhibitionArtwork.rotation ?? 0}
              onChange={(v) => {
                if (!currentArtworkId) return
                dispatch(
                  updateArtworkPosition({
                    artworkId: currentArtworkId,
                    artworkPosition: { rotation: v },
                  }),
                )
              }}
              disabled={isLocked}
              aria-label="Artwork rotation"
            />
          </div>
        )}
      </Section>
    </>
  )
}

export default ArtworkPanel
