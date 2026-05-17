'use client'

import { useSelector } from 'react-redux'

import { Checkbox } from '@/components/ui/Checkbox'
import { NumberInput } from '@/components/ui/NumberInput'
import { Section } from '@/components/ui/Section/Section'
import { Select } from '@/components/ui/Select'
import { Slider } from '@/components/ui/Slider'
import { Text } from '@/components/ui/Typography'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkVideoHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkVideoHandlers'
import PresentationSection from '@/components/wallview/RightPanel/PresentationSection/PresentationSection'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'

const playModeOptions = [
  { label: 'Play on Proximity', value: 'proximity' },
  { label: 'Always Play', value: 'always' },
  { label: 'Play on Click', value: 'click' },
]

const ArtisticVideoPanel = ({ disabled }: { disabled?: boolean }) => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const {
    videoPlayMode,
    videoLoop,
    videoVolume,
    videoProximityDistance,
    soundSpatial,
    soundDistance,
    // Presentation
    showSupport,
    supportColor,
    supportThickness,
    showFrame,
    frameColor,
    frameSize,
    frameThickness,
    frameMaterial,
    frameCornerStyle,
    frameTextureScale,
    frameTextureRotation,
    frameTextureRoughness,
    frameTextureNormalScale,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    passepartoutThickness,
    hideShadow,
  } = useArtworkDetails(currentArtworkId!)

  const { handleEditVideo } = useArtworkVideoHandlers(currentArtworkId!)

  return (
    <>
      {/* Video Properties */}
      <Section title="Video Properties" disabled={disabled}>
        {/* Play Mode Selector */}
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Play Mode
            </Text>
            <Select<string>
              options={playModeOptions}
              value={videoPlayMode}
              onChange={(val) =>
                handleEditVideo('videoPlayMode', val as 'proximity' | 'always' | 'click')
              }
            />
          </div>
        </div>

        {/* Loop */}
        <Checkbox
          checked={videoLoop ?? true}
          onChange={(e) => handleEditVideo('videoLoop', e.target.checked)}
          label="Loop"
        />

        {/* Volume Slider */}
        <div className={styles.item}>
          <div className={styles.sliderHeader}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Volume
            </Text>
            <span className={styles.sliderValue}>{Math.round((videoVolume ?? 1) * 100)}%</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={videoVolume ?? 1}
            onChange={(v) => handleEditVideo('videoVolume', v)}
            disabled={disabled}
            aria-label="Video volume"
          />
        </div>

        {/* Proximity Distance — only shown in proximity mode */}
        {videoPlayMode === 'proximity' && (
          <div className={styles.row}>
            <div className={styles.item}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>
                Proximity Distance (cm)
              </Text>
              <NumberInput
                value={Math.round((videoProximityDistance ?? 3) * 100)}
                min={100}
                max={5000}
                onChange={(e) =>
                  handleEditVideo('videoProximityDistance', Number(e.target.value) / 100)
                }
              />
            </div>
          </div>
        )}

        {/* Spatial Sound */}
        <Checkbox
          checked={soundSpatial ?? true}
          onChange={(e) => handleEditVideo('soundSpatial', e.target.checked)}
          label="Spatial Sound"
        />

        {/* Sound Distance — only visible when spatial is on */}
        {soundSpatial && (
          <div className={styles.row}>
            <div className={styles.item}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>
                Sound Distance (cm)
              </Text>
              <NumberInput
                value={Math.round((soundDistance ?? 5) * 100)}
                min={100}
                max={5000}
                onChange={(e) => handleEditVideo('soundDistance', Number(e.target.value) / 100)}
              />
            </div>
          </div>
        )}
      </Section>

      <PresentationSection
        disabled={disabled}
        showSupport={showSupport!}
        supportColor={supportColor!}
        supportThickness={supportThickness}
        showFrame={showFrame!}
        frameColor={frameColor!}
        frameSize={frameSize}
        frameThickness={frameThickness}
        frameMaterial={frameMaterial}
        frameCornerStyle={frameCornerStyle}
        frameTextureScale={frameTextureScale}
        frameTextureRotation={frameTextureRotation}
        frameTextureRoughness={frameTextureRoughness}
        frameTextureNormalScale={frameTextureNormalScale}
        showPassepartout={showPassepartout!}
        passepartoutColor={passepartoutColor!}
        passepartoutSize={passepartoutSize}
        passepartoutThickness={passepartoutThickness}
        hideShadow={hideShadow}
        onEdit={handleEditVideo}
      />
    </>
  )
}

export default ArtisticVideoPanel
