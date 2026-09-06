'use client'

import { Fragment, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection/CollapsibleSection'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Section } from '@/components/ui/Section/Section'
import { Slider } from '@/components/ui/Slider'
import { Toggle } from '@/components/ui/Toggle'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { getSpaceFeatures } from '@/config/spaceConfig'
import { hideLightingPanel } from '@/redux/slices/dashboardSlice'
import {
  setExhibitionField,
  setTrackLampRotation,
  setTrackLampEnabled,
  setTrackLampOffset,
} from '@/redux/slices/exhibitionSlice'
import type { TExhibition } from '@/types/exhibition'
import type { RootState } from '@/redux/store'

import styles from './LightingPanel.module.scss'

// Default values
const DEFAULT_AMBIENT_COLOR = '#e4e8f2'
const DEFAULT_AMBIENT_INTENSITY = 1.0
const DEFAULT_SKYLIGHT_COLOR = '#ffffff'
const DEFAULT_SKYLIGHT_INTENSITY = 4.0
const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0
const DEFAULT_TRACK_LAMP_COLOR = '#ffffff'
const DEFAULT_TRACK_LAMP_INTENSITY = 4.0
const DEFAULT_RECESSED_LAMP_COLOR = '#ffffff'
const DEFAULT_RECESSED_LAMP_INTENSITY = 4.0
const DEFAULT_RECESSED_LAMP_ANGLE = 0.45
const DEFAULT_RECESSED_LAMP_DISTANCE = 15.0
const DEFAULT_TRACK_LAMP_MATERIAL_COLOR = '#ffffff'
const DEFAULT_TRACK_LAMP_ANGLE = 0.45
const DEFAULT_TRACK_LAMP_DISTANCE = 5.0
const DEFAULT_WINDOW_COLOR = '#ffffff'
const DEFAULT_WINDOW_INTENSITY = 4.0
const DEFAULT_HDRI_ROTATION = 128
const DEFAULT_SHADOW_BLUR = 0.025
const DEFAULT_SHADOW_SPREAD = 1.2
const DEFAULT_SHADOW_OPACITY = 0.25
const DEFAULT_SHADOW_DIRECTION = 0.2

const HDRI_OPTIONS = [{ value: 'soil', label: 'Soil' }] as const

const CEILING_LIGHT_OPTIONS = [
  { value: 'track', label: 'Track Lamps' },
  { value: 'plafond', label: 'Plafond Lamps' },
  { value: 'track-plafond', label: 'Track Lamps + Plafond Lamps' },
] as const

const LightingPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = (field: keyof TExhibition, value: TExhibition[keyof TExhibition]) => {
    dispatch(setExhibitionField({ field, value }))
    setSaved(false)
  }

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) || 'paris'

  const ambientColor = useSelector(
    (state: RootState) => state.exhibition.ambientLightColor ?? DEFAULT_AMBIENT_COLOR,
  )
  const ambientIntensity = useSelector(
    (state: RootState) => state.exhibition.ambientLightIntensity ?? DEFAULT_AMBIENT_INTENSITY,
  )
  const skylightColor = useSelector(
    (state: RootState) => state.exhibition.skylightColor ?? DEFAULT_SKYLIGHT_COLOR,
  )
  const skylightIntensity = useSelector(
    (state: RootState) => state.exhibition.skylightIntensity ?? DEFAULT_SKYLIGHT_INTENSITY,
  )
  const lampColor = useSelector(
    (state: RootState) => state.exhibition.ceilingLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.ceilingLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )
  const trackLampColor = useSelector(
    (state: RootState) => state.exhibition.trackLampColor ?? DEFAULT_TRACK_LAMP_COLOR,
  )
  const trackLampIntensity = useSelector(
    (state: RootState) => state.exhibition.trackLampIntensity ?? DEFAULT_TRACK_LAMP_INTENSITY,
  )
  const recessedLampColor = useSelector(
    (state: RootState) => state.exhibition.recessedLampColor ?? DEFAULT_RECESSED_LAMP_COLOR,
  )
  const recessedLampIntensity = useSelector(
    (state: RootState) => state.exhibition.recessedLampIntensity ?? DEFAULT_RECESSED_LAMP_INTENSITY,
  )
  const recessedLampAngle = useSelector(
    (state: RootState) => state.exhibition.recessedLampAngle ?? DEFAULT_RECESSED_LAMP_ANGLE,
  )
  const recessedLampDistance = useSelector(
    (state: RootState) => state.exhibition.recessedLampDistance ?? DEFAULT_RECESSED_LAMP_DISTANCE,
  )
  const trackLampMaterialColor = useSelector(
    (state: RootState) =>
      state.exhibition.trackLampMaterialColor ?? DEFAULT_TRACK_LAMP_MATERIAL_COLOR,
  )
  const trackLampAngle = useSelector(
    (state: RootState) => state.exhibition.trackLampAngle ?? DEFAULT_TRACK_LAMP_ANGLE,
  )
  const trackLampDistance = useSelector(
    (state: RootState) => state.exhibition.trackLampDistance ?? DEFAULT_TRACK_LAMP_DISTANCE,
  )
  const trackLampSettings = useSelector((state: RootState) => state.exhibition.trackLampSettings)

  // How many track lamps exist comes from the loaded GLB, not a constant here.
  // A space with more lamps than the old hard-coded 14 used to show controls for
  // only the first 14, with the rest silently unreachable.
  // Kept GROUPED rather than flattened. Vienna authors 28 track lamps across two
  // rooms, and a flat list of 28 lamp blocks is unusable to scroll; each room
  // collapses instead. A space with no room grouping (Paris, Madrid) comes back
  // as a single anonymous group and still renders inline, so nothing that is
  // visible there today ends up behind a click.
  const trackLampGroups = useSelector((state: RootState) => state.scene.trackLampGroups)
  const ceilingLightMode = useSelector(
    (state: RootState) => state.exhibition.ceilingLightMode ?? 'track-plafond',
  )
  const windowColor = useSelector(
    (state: RootState) => state.exhibition.windowLightColor ?? DEFAULT_WINDOW_COLOR,
  )
  const windowIntensity = useSelector(
    (state: RootState) => state.exhibition.windowLightIntensity ?? DEFAULT_WINDOW_INTENSITY,
  )
  const windowTransparency = useSelector(
    (state: RootState) => state.exhibition.windowTransparency ?? false,
  )
  const hdriEnvironment = useSelector(
    (state: RootState) => state.exhibition.hdriEnvironment ?? 'soil',
  )
  const hdriRotation = useSelector(
    (state: RootState) => state.exhibition.hdriRotation ?? DEFAULT_HDRI_ROTATION,
  )
  const shadowBlur = useSelector(
    (state: RootState) => state.exhibition.shadowBlur ?? DEFAULT_SHADOW_BLUR,
  )
  const shadowSpread = useSelector(
    (state: RootState) => state.exhibition.shadowSpread ?? DEFAULT_SHADOW_SPREAD,
  )
  const shadowOpacity = useSelector(
    (state: RootState) => state.exhibition.shadowOpacity ?? DEFAULT_SHADOW_OPACITY,
  )
  const shadowDirection = useSelector(
    (state: RootState) => state.exhibition.shadowDirection ?? DEFAULT_SHADOW_DIRECTION,
  )

  // Get features from space config
  const spaceFeatures = getSpaceFeatures(spaceId)
  const hasSkylight = spaceFeatures.hasSkylight
  const hasLamps = spaceFeatures.hasLamps
  const hasTrackLamps = spaceFeatures.hasTrackLamps
  const hasRecessedLamps = spaceFeatures.hasRecessedLamps
  const hasWindows = spaceFeatures.hasWindows

  // Filter ceiling light options based on space features
  const availableCeilingLightOptions = CEILING_LIGHT_OPTIONS.filter((option) => {
    if (!hasTrackLamps) return option.value === 'plafond'
    return true
  })

  // If current mode is not available, fall back to the first available option
  const effectiveCeilingLightMode = availableCeilingLightOptions.some(
    (o) => o.value === ceilingLightMode,
  )
    ? ceilingLightMode
    : (availableCeilingLightOptions[0]?.value ?? 'plafond')

  const handleSave = async () => {
    if (!exhibitionId) return

    setSaving(true)
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambientLightColor: ambientColor,
          ambientLightIntensity: ambientIntensity,
          skylightColor,
          skylightIntensity,
          ceilingLampColor: lampColor,
          ceilingLampIntensity: lampIntensity,
          trackLampColor,
          trackLampIntensity,
          trackLampAngle,
          trackLampDistance,
          trackLampSettings: trackLampSettings ?? null,
          recessedLampColor,
          recessedLampIntensity,
          recessedLampAngle,
          recessedLampDistance,
          trackLampMaterialColor,
          windowLightColor: windowColor,
          windowLightIntensity: windowIntensity,
          windowTransparency,
          hdriEnvironment,
          hdriRotation,
          ceilingLightMode,
          shadowBlur,
          shadowSpread,
          shadowOpacity,
          shadowDirection,
        }),
      })

      if (response.ok) {
        setSaved(true)
      }
    } catch (error) {
      console.error('Failed to save lighting settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    dispatch(hideLightingPanel())
  }

  return (
    <SettingsPanel title="Lighting" onClose={handleClose}>
      <Section title="Environment">
        <div className={styles.field}>
          <label className={styles.label}>Sky Type</label>
          <select
            value={hdriEnvironment}
            onChange={(e) => set('hdriEnvironment', e.target.value)}
            className={styles.select}
          >
            {HDRI_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Sky Rotation</label>
            <span className={styles.sliderValue}>{hdriRotation.toFixed(0)}°</span>
          </div>
          <Slider
            min={0}
            max={360}
            step={1}
            value={hdriRotation}
            onChange={(v) => set('hdriRotation', v)}
            aria-label="Sky Rotation"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Ambient Color</label>
          <ColorPicker
            textColor={ambientColor}
            onColorSelect={(color) => set('ambientLightColor', color)}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Ambient Intensity</label>
            <span className={styles.sliderValue}>{ambientIntensity.toFixed(2)}</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={ambientIntensity}
            onChange={(v) => set('ambientLightIntensity', v)}
            aria-label="Ambient Intensity"
          />
        </div>
      </Section>

      {(hasSkylight || hasLamps || hasTrackLamps || hasRecessedLamps) && (
        <Section title="Ceiling">
          {hasSkylight && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Ceiling Light Color</label>
                <ColorPicker
                  textColor={skylightColor}
                  onColorSelect={(color) => set('skylightColor', color)}
                />
              </div>

              <div className={styles.field}>
                <div className={styles.sliderHeader}>
                  <label className={styles.label}>Ceiling Light Intensity</label>
                  <span className={styles.sliderValue}>{skylightIntensity.toFixed(2)}</span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={0.1}
                  value={skylightIntensity}
                  onChange={(v) => set('skylightIntensity', v)}
                  aria-label="Ceiling Light Intensity"
                />
              </div>
            </>
          )}

          {hasLamps && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Lamp Color</label>
                <ColorPicker
                  textColor={lampColor}
                  onColorSelect={(color) => set('ceilingLampColor', color)}
                />
              </div>

              <div className={styles.field}>
                <div className={styles.sliderHeader}>
                  <label className={styles.label}>Lamp Intensity</label>
                  <span className={styles.sliderValue}>{lampIntensity.toFixed(2)}</span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={0.1}
                  value={lampIntensity}
                  onChange={(v) => set('ceilingLampIntensity', v)}
                  aria-label="Lamp Intensity"
                />
              </div>
            </>
          )}

          {availableCeilingLightOptions.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>Ceiling Light Type</label>
              <select
                value={effectiveCeilingLightMode}
                onChange={(e) => set('ceilingLightMode', e.target.value)}
                className={styles.select}
              >
                {availableCeilingLightOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {hasRecessedLamps &&
            (effectiveCeilingLightMode === 'plafond' ||
              effectiveCeilingLightMode === 'track-plafond') && (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>Plafond Color</label>
                  <ColorPicker
                    textColor={recessedLampColor}
                    onColorSelect={(color) => set('recessedLampColor', color)}
                  />
                </div>

                <div className={styles.field}>
                  <div className={styles.sliderHeader}>
                    <label className={styles.label}>Plafond Intensity</label>
                    <span className={styles.sliderValue}>{recessedLampIntensity.toFixed(2)}</span>
                  </div>
                  <Slider
                    min={0}
                    max={10}
                    step={0.1}
                    value={recessedLampIntensity}
                    onChange={(v) => set('recessedLampIntensity', v)}
                    aria-label="Plafond Intensity"
                  />
                </div>

                <div className={styles.field}>
                  <div className={styles.sliderHeader}>
                    <label className={styles.label}>Plafond Angle</label>
                    <span className={styles.sliderValue}>
                      {(recessedLampAngle * (180 / Math.PI)).toFixed(0)}°
                    </span>
                  </div>
                  <Slider
                    min={0.1}
                    max={1.2}
                    step={0.05}
                    value={recessedLampAngle}
                    onChange={(v) => set('recessedLampAngle', v)}
                    aria-label="Plafond Angle"
                  />
                </div>

                <div className={styles.field}>
                  <div className={styles.sliderHeader}>
                    <label className={styles.label}>Plafond Distance</label>
                    <span className={styles.sliderValue}>{recessedLampDistance.toFixed(1)}m</span>
                  </div>
                  <Slider
                    min={1}
                    max={20}
                    step={0.5}
                    value={recessedLampDistance}
                    onChange={(v) => set('recessedLampDistance', v)}
                    aria-label="Plafond Distance"
                  />
                </div>
              </>
            )}
        </Section>
      )}

      {hasTrackLamps &&
        (effectiveCeilingLightMode === 'track' ||
          effectiveCeilingLightMode === 'track-plafond') && (
          <Section title="Track Lamps">
            <div className={styles.field}>
              <label className={styles.label}>Color</label>
              <ColorPicker
                textColor={trackLampColor}
                onColorSelect={(color) => set('trackLampColor', color)}
              />
            </div>

            <div className={styles.field}>
              <div className={styles.sliderHeader}>
                <label className={styles.label}>Intensity</label>
                <span className={styles.sliderValue}>{trackLampIntensity.toFixed(2)}</span>
              </div>
              <Slider
                min={0}
                max={10}
                step={0.1}
                value={trackLampIntensity}
                onChange={(v) => set('trackLampIntensity', v)}
                aria-label="Track Lamp Intensity"
              />
            </div>

            <div className={styles.field}>
              <div className={styles.sliderHeader}>
                <label className={styles.label}>Angle</label>
                <span className={styles.sliderValue}>
                  {(trackLampAngle * (180 / Math.PI)).toFixed(0)}°
                </span>
              </div>
              <Slider
                min={0.1}
                max={1.2}
                step={0.05}
                value={trackLampAngle}
                onChange={(v) => set('trackLampAngle', v)}
                aria-label="Track Lamp Angle"
              />
            </div>

            <div className={styles.field}>
              <div className={styles.sliderHeader}>
                <label className={styles.label}>Distance</label>
                <span className={styles.sliderValue}>{trackLampDistance.toFixed(1)}m</span>
              </div>
              <Slider
                min={1}
                max={10}
                step={0.5}
                value={trackLampDistance}
                onChange={(v) => set('trackLampDistance', v)}
                aria-label="Track Lamp Distance"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Material Color</label>
              <ColorPicker
                textColor={trackLampMaterialColor}
                onColorSelect={(color) => set('trackLampMaterialColor', color)}
              />
            </div>

            {/* Individual lamp controls, one collapsible section per room.
                `groupNodesByRoom` normalises the Blender naming, so `room0`
                becomes "Room 1" here and the authoring convention never reaches
                the artist. An ungrouped space yields a single anonymous group
                and renders inline, exactly as before. */}
            {trackLampGroups.map((group) => {
              const lamps = group.indices.map((i: number, position: number) => {
                const settings = trackLampSettings?.[String(i)]
                const isEnabled = settings?.enabled ?? true
                const rotation = settings?.rotation ?? 0
                const offset = settings?.offset ?? 0
                // Numbering restarts inside each room, because the section
                // header already says which room these belong to. Every label
                // below uses this same number: the sliders used to announce the
                // raw GLB node index, so a screen reader named a different lamp
                // than the one on screen.
                const label = `Lamp ${position + 1}`

                return (
                  <div key={`lamp-${i}`} className={styles.lampRow}>
                    <div className={styles.lampHeader}>
                      <span className={styles.lampLabel}>{label}</span>
                      <Toggle
                        checked={isEnabled}
                        onChange={() => {
                          dispatch(setTrackLampEnabled({ index: i, enabled: !isEnabled }))
                          setSaved(false)
                        }}
                        aria-label={`${label} enabled`}
                      />
                    </div>
                    <div className={styles.lampSlider}>
                      <Slider
                        min={-180}
                        max={180}
                        step={1}
                        value={rotation}
                        onChange={(v) => {
                          dispatch(setTrackLampRotation({ index: i, rotation: v }))
                          setSaved(false)
                        }}
                        aria-label={`${label} rotation`}
                      />
                      <span className={styles.sliderValue}>{rotation}°</span>
                    </div>
                    <div className={styles.lampSlider}>
                      <Slider
                        min={-2}
                        max={2}
                        step={0.01}
                        value={offset}
                        onChange={(v) => {
                          dispatch(setTrackLampOffset({ index: i, offset: v }))
                          setSaved(false)
                        }}
                        aria-label={`${label} offset`}
                      />
                      <span className={styles.sliderValue}>{offset.toFixed(2)}m</span>
                    </div>
                  </div>
                )
              })

              if (!group.room) return <Fragment key="track-lamps">{lamps}</Fragment>

              const roomNumber = Number(group.room.replace('room', '')) + 1
              return (
                <CollapsibleSection
                  key={group.room}
                  title={`Room ${roomNumber} · ${group.indices.length} lamps`}
                  persistKey={`track-lamps-${group.room}`}
                >
                  {lamps}
                </CollapsibleSection>
              )
            })}
          </Section>
        )}

      {hasWindows && (
        <Section title="Window">
          <div className={styles.sectionHeader}>
            <label className={styles.label}>Transparent</label>
            <Toggle
              checked={windowTransparency}
              onChange={() => set('windowTransparency', !windowTransparency)}
              aria-label="Window transparency"
            />
          </div>

          {windowTransparency ? (
            <div className={styles.field}>
              <label className={styles.label}>Window is transparent — HDRI visible</label>
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Color</label>
                <ColorPicker
                  textColor={windowColor}
                  onColorSelect={(color) => set('windowLightColor', color)}
                />
              </div>

              <div className={styles.field}>
                <div className={styles.sliderHeader}>
                  <label className={styles.label}>Intensity</label>
                  <span className={styles.sliderValue}>{windowIntensity.toFixed(2)}</span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={0.1}
                  value={windowIntensity}
                  onChange={(v) => set('windowLightIntensity', v)}
                  aria-label="Window Intensity"
                />
              </div>
            </>
          )}
        </Section>
      )}

      <Section title="Shadows">
        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Blur</label>
            <span className={styles.sliderValue}>{shadowBlur.toFixed(3)}</span>
          </div>
          <Slider
            min={0.01}
            max={0.08}
            step={0.005}
            value={shadowBlur}
            onChange={(v) => set('shadowBlur', v)}
            aria-label="Shadow Blur"
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Spread</label>
            <span className={styles.sliderValue}>{shadowSpread.toFixed(1)}</span>
          </div>
          <Slider
            min={0.5}
            max={3.0}
            step={0.1}
            value={shadowSpread}
            onChange={(v) => set('shadowSpread', v)}
            aria-label="Shadow Spread"
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Tightness</label>
            <span className={styles.sliderValue}>{shadowOpacity.toFixed(2)}</span>
          </div>
          <Slider
            min={0.05}
            max={0.8}
            step={0.01}
            value={shadowOpacity}
            onChange={(v) => set('shadowOpacity', v)}
            aria-label="Shadow Tightness"
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Direction</label>
            <span className={styles.sliderValue}>{shadowDirection.toFixed(2)}</span>
          </div>
          <Slider
            min={0.0}
            max={1.0}
            step={0.05}
            value={shadowDirection}
            onChange={(v) => set('shadowDirection', v)}
            aria-label="Shadow Direction"
          />
        </div>
      </Section>

      {/* Actions */}
      <div className={styles.actions}>
        <Button
          variant="primary"
          label={saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          onClick={handleSave}
          disabled={saving}
          className={styles.saveButton}
        />
      </div>
    </SettingsPanel>
  )
}

export default LightingPanel
