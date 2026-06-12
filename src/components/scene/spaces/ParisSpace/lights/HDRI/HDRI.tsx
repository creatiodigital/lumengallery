import { Environment, useEnvironment } from '@react-three/drei'
import { Component, type ReactNode } from 'react'
import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'
import { assetUrl } from '@/lib/assetUrl'

// PERF TEST: Set to false to disable HDRI environment
const ENABLE_HDRI = true
const DEFAULT_HDRI_ROTATION = 128 // degrees
const AVAILABLE_HDRIS = ['soil'] as const

// Preload default HDRI at module scope to avoid Loader setState-during-render warnings
useEnvironment.preload({ files: assetUrl('/assets/hdri/soil.hdr') })

// Error boundary to gracefully handle HDR load failures (e.g. on mobile Safari)
class HDRIErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    console.warn('HDRI failed to load, falling back to no environment:', error.message)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

const HDRI = () => {
  const rawHdri = useSelector((state: RootState) => state.exhibition.hdriEnvironment ?? 'soil')
  // Fallback to 'soil' if the stored HDRI no longer exists
  const hdriEnvironment = AVAILABLE_HDRIS.includes(rawHdri as (typeof AVAILABLE_HDRIS)[number])
    ? rawHdri
    : 'soil'
  const windowTransparency = useSelector(
    (state: RootState) => state.exhibition.windowTransparency ?? false,
  )
  const hdriRotation = useSelector(
    (state: RootState) => state.exhibition.hdriRotation ?? DEFAULT_HDRI_ROTATION,
  )

  // Skip HDRI if disabled for performance testing
  if (!ENABLE_HDRI) return null

  const rotationRadians = (hdriRotation * Math.PI) / 180

  return (
    <HDRIErrorBoundary>
      <Environment
        key={hdriEnvironment}
        background={windowTransparency}
        files={assetUrl(`/assets/hdri/${hdriEnvironment}.hdr`)}
        environmentIntensity={0.3}
        backgroundRotation={[0, rotationRadians, 0]}
      />
    </HDRIErrorBoundary>
  )
}

export default HDRI
