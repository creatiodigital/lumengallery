'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useGLTF } from '@react-three/drei'
import { Mesh } from 'three'

import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { pushToHistory } from '@/redux/slices/exhibitionSlice'
import type { RootState, AppDispatch } from '@/redux/store'

import { applyPresetToArtwork, type TPreset, type PresetType } from './applyPresetToArtwork'
import DeletePresetsModal from './DeletePresetsModal'
import SavePresetModal from './SavePresetModal'
import UpdatePresetModal from './UpdatePresetModal'
import styles from './PresetSection.module.scss'

type PresetSectionProps = {
  presetType: PresetType
}

const PresetSection = ({ presetType }: PresetSectionProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [presets, setPresets] = useState<TPreset[]>([])
  const [loading, setLoading] = useState(false)

  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  // Get bounding data for convert2DTo3D
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const gltfPath = getSpaceConfig(spaceId || 'paris').gltfPath
  const { nodes } = useGLTF(gltfPath) as unknown as { nodes: Record<string, Mesh> }
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  const artwork = currentArtworkId ? artworksById[currentArtworkId] : null
  const exhibitionArtwork = currentArtworkId ? exhibitionArtworksById[currentArtworkId] : null

  // Fetch presets from API
  const fetchPresets = useCallback(async () => {
    try {
      const response = await fetch('/api/presets')
      if (response.ok) {
        const data = await response.json()
        setPresets(data.filter((p: TPreset) => p.presetType === presetType))
      }
    } catch (error) {
      console.error('Failed to fetch presets:', error)
    }
  }, [presetType])

  useEffect(() => {
    fetchPresets()
  }, [fetchPresets])

  // Collect current artwork properties for saving
  const collectCurrentProperties = (): Record<string, unknown> | null => {
    if (!artwork || !exhibitionArtwork) return null

    const props: Record<string, unknown> = {
      presetType,
      // Dimensions from exhibition artwork (2D position data)
      width2d: exhibitionArtwork.width2d,
      height2d: exhibitionArtwork.height2d,
      // Frame — extract raw values from TOption objects
      showFrame: artwork.showFrame ?? false,
      frameColor: artwork.frameColor ?? '#000000',
      frameSize:
        typeof artwork.frameSize === 'object'
          ? (artwork.frameSize?.value ?? 5)
          : (artwork.frameSize ?? 5),
      frameThickness:
        typeof artwork.frameThickness === 'object'
          ? (artwork.frameThickness?.value ?? 0.5)
          : (artwork.frameThickness ?? 0.5),
      frameMaterial: artwork.frameMaterial ?? 'plastic',
      frameCornerStyle: artwork.frameCornerStyle ?? 'mitered',
      frameTextureScale: artwork.frameTextureScale ?? 2.0,
      frameTextureRotation: artwork.frameTextureRotation ?? 0,
      frameTextureRoughness: artwork.frameTextureRoughness ?? 0.6,
      frameTextureNormalScale: artwork.frameTextureNormalScale ?? 0.5,
      // Passepartout
      showPassepartout: artwork.showPassepartout ?? false,
      passepartoutColor: artwork.passepartoutColor ?? '#ffffff',
      passepartoutSize:
        typeof artwork.passepartoutSize === 'object'
          ? (artwork.passepartoutSize?.value ?? 10)
          : (artwork.passepartoutSize ?? 10),
      passepartoutThickness:
        typeof artwork.passepartoutThickness === 'object'
          ? (artwork.passepartoutThickness?.value ?? 0.3)
          : (artwork.passepartoutThickness ?? 0.3),
      // Border (white paper margin around image)
      showPaperBorder: artwork.showPaperBorder ?? false,
      paperBorderSize:
        typeof artwork.paperBorderSize === 'object'
          ? (artwork.paperBorderSize?.value ?? 0)
          : (artwork.paperBorderSize ?? 0),
      // Support
      showSupport: artwork.showSupport ?? false,
      supportThickness:
        typeof artwork.supportThickness === 'object'
          ? (artwork.supportThickness?.value ?? 2.0)
          : (artwork.supportThickness ?? 2.0),
      supportColor: artwork.supportColor ?? '#ffffff',
      // Shadow
      hideShadow: artwork.hideShadow ?? false,
    }

    // Text properties (only for text presets)
    if (presetType === 'text') {
      props.fontFamily =
        typeof artwork.fontFamily === 'object'
          ? (artwork.fontFamily?.value ?? 'Montserrat')
          : (artwork.fontFamily ?? 'Montserrat')
      props.fontSize =
        typeof artwork.fontSize === 'object'
          ? (artwork.fontSize?.value ?? 16)
          : (artwork.fontSize ?? 16)
      props.fontWeight =
        typeof artwork.fontWeight === 'object'
          ? (artwork.fontWeight?.value ?? '400')
          : (artwork.fontWeight ?? '400')
      props.letterSpacing =
        typeof artwork.letterSpacing === 'object'
          ? (artwork.letterSpacing?.value ?? 0)
          : (artwork.letterSpacing ?? 0)
      props.lineHeight =
        typeof artwork.lineHeight === 'object'
          ? (artwork.lineHeight?.value ?? 1.4)
          : (artwork.lineHeight ?? 1.4)
      props.textColor = artwork.textColor ?? '#000000'
      props.textBackgroundColor = artwork.textBackgroundColor ?? null
      props.textBackgroundTexture = artwork.textBackgroundTexture ?? null
      props.showTextBorder = artwork.showTextBorder ?? false
      props.textBorderColor = artwork.textBorderColor ?? '#c9a96e'
      props.textBorderOffset = artwork.textBorderOffset?.value ?? 1.2
      props.showMonogram = artwork.showMonogram ?? false
      props.monogramColor = artwork.monogramColor ?? '#c0392b'
      props.monogramOpacity = artwork.monogramOpacity?.value ?? 1.0
      props.monogramPosition = artwork.monogramPosition ?? 'bottom'
      props.monogramOffset = artwork.monogramOffset?.value ?? 2
      props.monogramSize = artwork.monogramSize?.value ?? 4
      props.textAlign = artwork.textAlign ?? 'left'
      props.textVerticalAlign = artwork.textVerticalAlign ?? 'top'
      props.textPadding =
        (artwork.textPadding && 'value' in artwork.textPadding
          ? artwork.textPadding.value
          : artwork.textPadding) ?? 0
      props.textPaddingTop = artwork.textPaddingTop?.value ?? 0
      props.textPaddingBottom = artwork.textPaddingBottom?.value ?? 0
      props.textPaddingLeft = artwork.textPaddingLeft?.value ?? 0
      props.textPaddingRight = artwork.textPaddingRight?.value ?? 0
      props.textThickness =
        typeof artwork.textThickness === 'object'
          ? (artwork.textThickness?.value ?? 0)
          : (artwork.textThickness ?? 0)
    }

    // Shape properties (only for shape presets)
    if (presetType === 'shape') {
      props.shapeType = artwork.shapeType ?? 'rectangle'
      props.shapeColor = artwork.shapeColor ?? '#000000'
      props.shapeOpacity = artwork.shapeOpacity ?? 1
    }

    return props
  }

  // Save preset
  const handleSavePreset = async (name: string) => {
    const properties = collectCurrentProperties()
    if (!properties) return

    setLoading(true)
    try {
      const response = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...properties }),
      })

      if (response.ok) {
        await fetchPresets()
        setShowModal(false)
      }
    } catch (error) {
      console.error('Failed to save preset:', error)
    } finally {
      setLoading(false)
    }
  }

  // Apply preset to current artwork
  const handleApplyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset || !currentArtworkId) return

    // Block applying presets on locked artworks
    if (exhibitionArtwork?.locked) return

    dispatch(pushToHistory())
    applyPresetToArtwork(
      dispatch,
      preset,
      currentArtworkId,
      presetType,
      exhibitionArtworksById,
      boundingData,
    )
  }

  // Update preset
  const handleUpdatePreset = async (presetId: string) => {
    const properties = collectCurrentProperties()
    if (!properties) return

    setLoading(true)
    try {
      const response = await fetch(`/api/presets/${presetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(properties),
      })

      if (response.ok) {
        await fetchPresets()
        setShowUpdateModal(false)
      }
    } catch (error) {
      console.error('Failed to update preset:', error)
    } finally {
      setLoading(false)
    }
  }

  // Delete preset
  const handleDeletePreset = async (presetId: string) => {
    try {
      const response = await fetch(`/api/presets/${presetId}`, { method: 'DELETE' })
      if (response.ok) {
        await fetchPresets()
      }
    } catch (error) {
      console.error('Failed to delete preset:', error)
    }
  }

  // Build select options from presets
  const presetOptions = presets.map((p) => ({ label: p.name, value: p.id }))

  return (
    <>
      <div className={styles.presetSection}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Presets
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              font="dashboard"
              size="small"
              variant="secondary"
              label="Add"
              onClick={() => setShowModal(true)}
              fullWidth
            />
          </div>
          <div className={styles.item}>
            <Button
              font="dashboard"
              size="small"
              variant="secondary"
              label="Update"
              onClick={() => setShowUpdateModal(true)}
              disabled={presets.length === 0}
              fullWidth
            />
          </div>
          <div className={styles.item}>
            <Button
              font="dashboard"
              size="small"
              variant="secondary"
              label="Delete"
              onClick={() => setShowDeleteModal(true)}
              disabled={presets.length === 0}
              fullWidth
            />
          </div>
        </div>
        <div className={styles.row}>
          <div
            className={styles.item}
            style={presets.length === 0 ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
          >
            <Text font="dashboard" as="label" size="xs" className={styles.applyLabel}>
              Apply Preset
            </Text>
            <Select<string>
              options={
                presets.length > 0
                  ? [{ label: '– Select –', value: '' }, ...presetOptions]
                  : [{ label: 'No presets yet', value: '' }]
              }
              value=""
              onChange={(val) => {
                if (val && presets.length > 0) handleApplyPreset(val)
              }}
            />
          </div>
        </div>
      </div>

      {showModal && (
        <SavePresetModal
          onSave={handleSavePreset}
          onClose={() => setShowModal(false)}
          loading={loading}
          existingNames={presets.map((p) => p.name)}
        />
      )}

      {showDeleteModal && (
        <DeletePresetsModal
          presets={presets}
          onDelete={async (presetId) => {
            await handleDeletePreset(presetId)
          }}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {showUpdateModal && (
        <UpdatePresetModal
          presets={presets}
          onUpdate={handleUpdatePreset}
          onClose={() => setShowUpdateModal(false)}
          loading={loading}
        />
      )}
    </>
  )
}

export default PresetSection
