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

import {
  EDITION_INK_HEIGHT_EM,
  EDITION_INK_TOP_EM,
  EDITION_NUMBER_CLEARANCE_CM,
  EDITION_NUMBER_FONT_SIZE_CM,
  editionLeftBearingEm,
} from '../editionNumberMetrics'

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

// Em size of the pencilled number, metres — the shared physical size the 2D
// schema uses too, so the two previewers show the same number-to-print ratio.
const EDITION_NUMBER_FONT_SIZE_M = EDITION_NUMBER_FONT_SIZE_CM / 100
const EDITION_NUMBER_CLEARANCE_M = EDITION_NUMBER_CLEARANCE_CM / 100

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
            border, not the horizontal one.

            Placed by the glyphs' INK box (see editionNumberMetrics), not by
            troika's text box: anchoring the box at the image's edges leaves
            Caveat's own side bearings as visible slack, which reads as the
            number being indented from the left edge and floating below the
            image. Anchoring at the baseline and offsetting by the measured
            ink instead puts the ink's left edge flush with the image's left
            edge and its top a hair under the image, at every print size. */}
        {editionLabel &&
          paperBorderYM > 0 &&
          (() => {
            const fontSizeM = Math.min(EDITION_NUMBER_FONT_SIZE_M, paperBorderYM * 0.7)
            // Clamped to what the border has left below the ink, so the
            // descending slash can never cross the sheet's bottom edge.
            const clearanceM = Math.max(
              0,
              Math.min(
                EDITION_NUMBER_CLEARANCE_M,
                paperBorderYM - fontSizeM * EDITION_INK_HEIGHT_EM,
              ),
            )
            const baselineY = -(heightM / 2 + clearanceM + fontSizeM * EDITION_INK_TOP_EM)
            const inkLeftX = -widthM / 2 - editionLeftBearingEm(editionLabel) * fontSizeM
            return (
              <Text
                font={EDITION_FONT_URL}
                color="#111111"
                anchorX="left"
                anchorY="top-baseline"
                fontSize={fontSizeM}
                position={[inkLeftX, baselineY, 0.002]}
              >
                {editionLabel}
              </Text>
            )
          })()}
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
