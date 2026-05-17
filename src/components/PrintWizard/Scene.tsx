'use client'

import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'

import { Slider } from '@/components/ui/Slider'

import type { Catalog, WizardConfig } from '@/lib/print-providers'

import { Floor } from './scene/Floor'
import { PreviewArtwork } from './scene/PreviewArtwork'
import { Room } from './scene/Room'

import styles from './PrintWizard.module.scss'

interface SceneProps {
  imageUrl: string
  catalog: Catalog
  config: WizardConfig
  /** Hide the artwork + frame until a destination is chosen. */
  configReady: boolean
}

// Tilt slider range — in degrees. Bounded so the camera stays close
// to head-on (the canonical sizing view) and never disorients buyers.
const MAX_TILT_DEG = 35
// Snap to exactly 0° when the buyer drags within this window — makes
// recentering hit-the-tick easy without needing pixel precision.
const SNAP_TO_ZERO_DEG = 2

export const Scene = ({ imageUrl, catalog, config, configReady }: SceneProps) => {
  // Conscious-act control: buyer drags the slider to tilt the scene
  // and inspect the frame's depth profile. No mouse-orbit, no auto
  // rotation — the head-on view stays the default for sizing reads.
  const [tiltDeg, setTiltDeg] = useState(0)
  const tiltRad = (tiltDeg * Math.PI) / 180

  // Explicit reset on mount — keeps the canonical head-on view
  // guaranteed whenever the Scene comes into view, regardless of any
  // upstream state seeding or browser-restored input values.
  useEffect(() => {
    setTiltDeg(0)
  }, [])

  // Snap near-zero values to exactly 0° so the handle lines up with
  // the centre tick without needing pixel-precise drags.
  const handleTiltChange = (value: number) => {
    setTiltDeg(Math.abs(value) <= SNAP_TO_ZERO_DEG ? 0 : value)
  }

  return (
    <div className={styles.sceneWrapper}>
      <div className={styles.sceneCanvas}>
        {!configReady && (
          <div className={styles.scenePrompt}>
            <p className={styles.scenePromptText}>
              Pick a shipping destination to see the preview, size details and price for your print.
            </p>
          </div>
        )}
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{
            position: [0, -0.1, 3],
            fov: 40,
            rotation: [-0.12, 0, 0],
          }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={['#e2dccf']} />

          <ambientLight intensity={1.25} />
          <directionalLight
            position={[1.5, 2, 2]}
            intensity={1.5}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-1.5, 1, 1]} intensity={0.65} />
          <hemisphereLight args={['#ffffff', '#efeae0', 0.55]} />

          {/* Rotate the whole scene around the Y axis instead of the
              camera — visually equivalent, simpler, and the camera
              keeps its fixed head-on framing. */}
          <group rotation={[0, tiltRad, 0]}>
            <Room />
            <Floor />

            <Suspense fallback={null}>
              {configReady && (
                <PreviewArtwork imageUrl={imageUrl} catalog={catalog} config={config} />
              )}
            </Suspense>
          </group>
        </Canvas>
      </div>

      {configReady && (
        <div className={styles.tiltControl}>
          <span className={styles.tiltControlLabel}>See it from the side</span>
          <div className={styles.tiltSliderWrap}>
            <Slider
              value={tiltDeg}
              onChange={handleTiltChange}
              min={-MAX_TILT_DEG}
              max={MAX_TILT_DEG}
              step={1}
              aria-label="See it from the side"
            />
            <button
              type="button"
              className={styles.tiltCenterTick}
              onClick={() => setTiltDeg(0)}
              aria-label="Reset to head-on view"
              title="Reset to head-on view"
            />
          </div>
        </div>
      )}
    </div>
  )
}
