'use client'

import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'

import { useRef, useState, useCallback, Suspense } from 'react'
import { Mesh } from 'three'
import { useSelector } from 'react-redux'
import { Volume2, VolumeX } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { Loader } from '@/components/ui/Loader'
import {
  SceneAudioProvider,
  useSceneAudioState,
  useSceneAudioActions,
} from '@/contexts/SceneAudioContext'
import SceneContext from '@/contexts/SceneContext'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import Controls from './controls'

import { SceneErrorBoundary } from './SceneErrorBoundary'
import styles from './Scene.module.scss'
import { Space } from './Space'
import { WebGLMonitor } from './WebGLMonitor'

interface SceneProps {
  hideLoader?: boolean
}

const FloatingMuteButton = () => {
  const { hasActiveAudio, isMuted } = useSceneAudioState()
  const { toggleMute } = useSceneAudioActions()

  if (!hasActiveAudio) return null

  return (
    <Button
      variant="ghost"
      onClick={toggleMute}
      className={styles.stopButton}
      title={isMuted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={isMuted}
    >
      {isMuted ? (
        <VolumeX size={20} strokeWidth={ICON_STROKE_WIDTH} />
      ) : (
        <Volume2 size={20} strokeWidth={ICON_STROKE_WIDTH} />
      )}
    </Button>
  )
}

export const Scene = ({ hideLoader }: SceneProps = {}) => {
  const wallRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const windowRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const glassRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const exhibitionUrl = useSelector((state: RootState) => state.exhibition.url)

  const handlePlaceholderClick = (_wallId: string) => {
    // Placeholder click handler - used by Space component
  }

  const artworks: TArtwork[] = []

  // EXPERIMENT — TEMPORARY. Fill-rate test: cost is pixels × lights, and at dpr 2
  // a 27" 5K panel renders 5120×2880 — four times the pixels of 1×, with all 22
  // spotlights evaluated on every one of them. Texture memory measured at a
  // harmless 344 MB, draw calls and triangles are modest, and removing the
  // frames changed nothing — so this is the last untested multiplier.
  // Restore to [1, 2] to revert.
  const [dpr, setDpr] = useState<[number, number]>([1, 1.5])

  const handlePerformanceDecline = useCallback(() => {
    setDpr([1, 1.5])
  }, [])

  const handlePerformanceIncline = useCallback(() => {
    setDpr([1, 1.5])
  }, [])

  return (
    <SceneAudioProvider>
      <SceneContext.Provider value={{ wallRefs, windowRefs, glassRefs }}>
        <div className={styles.scene} onContextMenu={(e) => e.preventDefault()}>
          <SceneErrorBoundary exhibitionUrl={exhibitionUrl}>
            <Canvas
              shadows={false}
              dpr={dpr}
              gl={{
                antialias: false,
                powerPreference: 'high-performance',
              }}
            >
              <PerformanceMonitor
                onDecline={handlePerformanceDecline}
                onIncline={handlePerformanceIncline}
              />
              <WebGLMonitor exhibitionUrl={exhibitionUrl} />
              <Suspense fallback={hideLoader ? null : <Loader />}>
                <group>
                  <Controls />
                  <Space onPlaceholderClick={handlePlaceholderClick} artworks={artworks} />
                </group>
              </Suspense>
            </Canvas>
          </SceneErrorBoundary>
          {hideLoader && <FloatingMuteButton />}
        </div>
      </SceneContext.Provider>
    </SceneAudioProvider>
  )
}
