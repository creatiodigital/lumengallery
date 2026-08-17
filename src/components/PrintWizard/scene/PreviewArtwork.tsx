'use client'

import { useMemo } from 'react'
import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { useLoader } from '@react-three/fiber'
import { Text } from '@react-three/drei'

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
  /** Limited editions only: "1/50" rendered bottom-left on the print face. */
  editionLabel?: string
}

// Caveat hand for the edition number — matches theprintspace's on-print
// numbering. Drop a Caveat .ttf at this path in public/fonts; troika
// falls back to its default font if it's missing.
const EDITION_FONT_URL = '/fonts/caveat-regular.ttf'

// Simulates a real edition number an artist pencils in the bottom margin:
// a roughly constant physical size no matter how big the print is. troika
// renders digits at ~70% of the em size, so 0.022m em ≈ 15mm digits —
// legible in-preview while still reading as hand-written. FIXED, never
// scaled to the print's dimensions; only shrunk if the paper border is too
// thin to hold it (the border is a fixed cm per variant, itself independent
// of the print size). Kept in sync with EDITION_NUMBER_HEIGHT_CM (SizeSchema).
const EDITION_NUMBER_HEIGHT_M = 0.022

// Fixed gap from the bottom edge of the image to the number's baseline so the
// spacing stays constant across prints — it does NOT scale with the print or
// the border. Capped only so the number can't fall outside a thin border.
const EDITION_NUMBER_GAP_M = 0.014

const ARTWORK_Z = 0.012

// Sane fallbacks if the catalog's option visuals don't carry a hint.
const DEFAULT_MOULDING_WIDTH_CM = 2.0
const DEFAULT_MOULDING_DEPTH_CM = 2.2
// Default frame = "White — Thin" moulding (#f2f2f2), matching the TPS catalog.
const DEFAULT_FRAME_HEX = '#f2f2f2'
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
  editionLabel,
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
  // Vertical (top/bottom) border — only diverges from the horizontal
  // value for fixed-sheet limited editions, where the sheet's shape
  // differs from the artwork's (see variantToWizardConfig.ts). Falls
  // back to the horizontal value everywhere else so nothing diverges.
  const borderYCm = config.borders?.['border']?.verticalCm ?? borderCm
  const matCm = getEffectiveMatCm(catalog, config)

  const framed = visuals.framed === true
  const paperBorderM = borderCm / 100
  const paperBorderYM = borderYCm / 100
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
    // Paper sheet, metres — horizontal and vertical borders each apply
    // to their own axis so a fixed-sheet edition draws the real sheet
    // shape instead of a uniform-border approximation.
    const paperWidthM = widthM + paperBorderM * 2
    const paperHeightM = heightM + paperBorderYM * 2
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
        {/* Limited-edition number — bottom-left, in the paper margin just
            below the image, in the Caveat hand it ships with. The number
            sits in the BOTTOM margin, so it's bounded by the vertical
            border, not the horizontal one. */}
        {editionLabel && paperBorderYM > 0 && (
          <Text
            font={EDITION_FONT_URL}
            color="#111111"
            anchorX="left"
            anchorY="middle"
            fontSize={Math.min(EDITION_NUMBER_HEIGHT_M, paperBorderYM * 0.7)}
            position={[
              -widthM / 2,
              -(heightM / 2 + Math.min(EDITION_NUMBER_GAP_M, paperBorderYM * 0.6)),
              0.002,
            ]}
          >
            {editionLabel}
          </Text>
        )}
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
          paperBorderYM={paperBorderYM}
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
          paperBorderYM={paperBorderYM}
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
          paperBorderYM={paperBorderYM}
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
          paperBorderYM={paperBorderYM}
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
