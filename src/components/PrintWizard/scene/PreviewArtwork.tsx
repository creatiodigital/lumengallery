'use client'

import { useMemo } from 'react'
import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { useLoader } from '@react-three/fiber'

import {
  type Catalog,
  type WizardConfig,
  collectVisualHints,
  getEffectiveBorderCm,
  getEffectiveMatCm,
  getEffectiveSizeCm,
} from '@/lib/print-providers'

import { BoxPreview } from './preview/BoxPreview'
import { FloatingPreview } from './preview/FloatingPreview'
import { PaperSheet } from './preview/parts/PaperSheet'
import { PrintPlane } from './preview/parts/PrintPlane'
import { StandardPreview } from './preview/StandardPreview'
import { TrayPreview } from './preview/TrayPreview'

interface PreviewArtworkProps {
  imageUrl: string
  catalog: Catalog
  config: WizardConfig
}

const ARTWORK_Z = 0.012

// Sane fallbacks if the catalog's option visuals don't carry a hint.
const DEFAULT_MOULDING_WIDTH_CM = 2.0
const DEFAULT_MOULDING_DEPTH_CM = 2.2
const DEFAULT_FRAME_HEX = '#0b0b0b'
const DEFAULT_FRAME_ROUGHNESS = 0.4
const DEFAULT_PAPER_ROUGHNESS = 0.7
const DEFAULT_MAT_HEX = '#f6f3ec'

/**
 * Frame-type-aware preview dispatcher. Reads the wizard config, derives
 * shared dimensions / materials, then hands off to the matching frame
 * component (Standard / Box / Floating). Print-only (`format` ≠
 * `framing`) renders the paper print without any frame chrome.
 */
export const PreviewArtwork = ({
  imageUrl,
  catalog,
  config,
}: PreviewArtworkProps) => {
  // Hooks must be called unconditionally on every render. Anything we
  // need before the `effectiveSize` early-return below has to be
  // computed and hooked-into here, otherwise React's hook order
  // shifts when `effectiveSize` flips between null and not-null and
  // state corrupts.
  const visuals = collectVisualHints(catalog, config)

  const frameHex = visuals.frameColorHex ?? DEFAULT_FRAME_HEX
  const frameRoughness = visuals.frameRoughness ?? DEFAULT_FRAME_ROUGHNESS

  const texture = useLoader(TextureLoader, imageUrl)
  useMemo(() => {
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.anisotropy = 8
    texture.center.set(0.5, 0.5)
    texture.rotation = 0
    texture.needsUpdate = true
  }, [texture])

  const frameMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: frameHex,
        roughness: frameRoughness,
        metalness: 0.05,
      }),
    [frameHex, frameRoughness],
  )

  // Now safe to bail out early — every hook above has fired.
  const effectiveSize = getEffectiveSizeCm(catalog, config)
  if (!effectiveSize) return null

  const borderCm = getEffectiveBorderCm(config, 'border')
  const matCm = getEffectiveMatCm(catalog, config)

  const framed = visuals.framed === true
  const paperBorderM = borderCm / 100
  const mouldingWidthM = (visuals.mouldingWidthCm ?? DEFAULT_MOULDING_WIDTH_CM) / 100
  const mouldingDepthM = (visuals.mouldingDepthCm ?? DEFAULT_MOULDING_DEPTH_CM) / 100
  const paperRoughness = visuals.paperRoughness ?? DEFAULT_PAPER_ROUGHNESS
  const matHex = visuals.matColorHex ?? DEFAULT_MAT_HEX

  // Sizes are stored in the artwork's natural orientation — render the
  // plane at exactly those dimensions, no orientation flipping.
  const widthM = effectiveSize.widthCm / 100
  const heightM = effectiveSize.heightCm / 100

  // Unframed: print + optional paper border. No frame chrome. The
  // paper sheet sits behind the print, extending outward by the
  // border on every side — same convention as the framed previews.
  if (!framed) {
    const paperWidthM = widthM + paperBorderM * 2
    const paperHeightM = heightM + paperBorderM * 2
    return (
      <group position={[0, 0, ARTWORK_Z]}>
        {paperBorderM > 0 && (
          <PaperSheet widthM={paperWidthM} heightM={paperHeightM} roughness={paperRoughness} />
        )}
        <PrintPlane
          widthM={widthM}
          heightM={heightM}
          texture={texture}
          roughness={paperRoughness}
        />
      </group>
    )
  }

  const frameTypeId = config.values.frameType
  // Matted is only meaningful for Standard / Box (windowMount cascades
  // hide it for Floating); guard at render time too in case visuals
  // carry a stale matCm value.
  const matBorderM = matCm > 0 ? matCm / 100 : 0

  return (
    <group position={[0, 0, ARTWORK_Z]}>
      {frameTypeId === 'floating' ? (
        <FloatingPreview
          texture={texture}
          printWidthM={widthM}
          printHeightM={heightM}
          paperBorderM={paperBorderM}
          mouldingWidthM={mouldingWidthM}
          mouldingDepthM={mouldingDepthM}
          frameMaterial={frameMaterial}
          paperRoughness={paperRoughness}
        />
      ) : frameTypeId === 'tray' ? (
        <TrayPreview
          texture={texture}
          printWidthM={widthM}
          printHeightM={heightM}
          paperBorderM={paperBorderM}
          mouldingWidthM={mouldingWidthM}
          mouldingDepthM={mouldingDepthM}
          frameMaterial={frameMaterial}
          paperRoughness={paperRoughness}
        />
      ) : frameTypeId === 'box' ? (
        <BoxPreview
          texture={texture}
          printWidthM={widthM}
          printHeightM={heightM}
          paperBorderM={paperBorderM}
          matBorderM={matBorderM}
          matHex={matHex}
          mouldingWidthM={mouldingWidthM}
          mouldingDepthM={mouldingDepthM}
          frameMaterial={frameMaterial}
          paperRoughness={paperRoughness}
        />
      ) : (
        // Default to Standard when frameTypeId is 'standard' or
        // undefined (catalog default before the buyer picks).
        <StandardPreview
          texture={texture}
          printWidthM={widthM}
          printHeightM={heightM}
          paperBorderM={paperBorderM}
          matBorderM={matBorderM}
          matHex={matHex}
          mouldingWidthM={mouldingWidthM}
          mouldingDepthM={mouldingDepthM}
          frameMaterial={frameMaterial}
          paperRoughness={paperRoughness}
        />
      )}
    </group>
  )
}
