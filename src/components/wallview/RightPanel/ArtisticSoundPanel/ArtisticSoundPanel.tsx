'use client'

import { useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { NumberInput } from '@/components/ui/NumberInput'
import { Section } from '@/components/ui/Section/Section'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkSoundHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkSoundHandlers'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'

const iconOptions = [
  { label: 'Volume', value: 'volume-2' },
  { label: 'Headphones', value: 'headphones' },
]

const playModeOptions = [
  { label: 'Play Once', value: 'play-once' },
  { label: 'Loop', value: 'loop' },
]

const ArtisticSoundPanel = ({ disabled }: { disabled?: boolean }) => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const {
    soundIcon,
    soundPlayMode,
    soundSpatial,
    soundDistance,
    soundBackgroundColor,
    soundIconColor,
    soundIconSize,
  } = useArtworkDetails(currentArtworkId!)

  const { handleEditSound } = useArtworkSoundHandlers(currentArtworkId!)

  return (
    <>
      {/* Sound Settings */}
      <Section title="Playback" disabled={disabled}>
        {/* Icon Selector */}
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Icon
            </Text>
            <Select<string>
              options={iconOptions}
              value={soundIcon}
              onChange={(val) => handleEditSound('soundIcon', val)}
            />
          </div>
        </div>

        {/* Play Mode Selector */}
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Play Mode
            </Text>
            <Select<string>
              options={playModeOptions}
              value={soundPlayMode}
              onChange={(val) => handleEditSound('soundPlayMode', val as 'loop' | 'play-once')}
            />
          </div>
        </div>

        {/* Spatiality Checkbox */}
        <Checkbox
          checked={soundSpatial ?? true}
          onChange={(e) => handleEditSound('soundSpatial', e.target.checked)}
          label="Positional Sound"
        />

        {/* Distance control — only visible when positional is on */}
        {soundSpatial && (
          <div className={styles.row}>
            <div className={styles.item}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>
                Distance (cm)
              </Text>
              <NumberInput
                value={Math.round((soundDistance ?? 5) * 100)}
                min={100}
                max={5000}
                onChange={(e) => handleEditSound('soundDistance', Number(e.target.value) / 100)}
              />
            </div>
          </div>
        )}
      </Section>

      {/* Appearance */}
      <Section title="Appearance" disabled={disabled}>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Icon Color
            </Text>
            <ColorPicker
              textColor={soundIconColor ?? '#000000'}
              onColorSelect={(value) => handleEditSound('soundIconColor', value)}
            />
          </div>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Background
            </Text>
            <div className={styles.backgroundColorRow}>
              <ColorPicker
                textColor={soundBackgroundColor ?? '#ffffff'}
                onColorSelect={(value) => handleEditSound('soundBackgroundColor', value)}
              />
              <Button
                size="small"
                variant="primary"
                label="None"
                onClick={() => handleEditSound('soundBackgroundColor', null)}
              />
            </div>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Icon Size
            </Text>
            <NumberInput
              value={soundIconSize ?? 24}
              min={8}
              max={128}
              onChange={(e) => handleEditSound('soundIconSize', Number(e.target.value))}
            />
          </div>
        </div>
      </Section>
    </>
  )
}

export default ArtisticSoundPanel
