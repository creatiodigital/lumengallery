import type { Material, Texture } from 'three'

import Frame from '@/components/scene/spaces/objects/Frame/Frame'

import { Backboard } from './parts/Backboard'
import { PaperSheet } from './parts/PaperSheet'
import { Plinth } from './parts/Plinth'
import { PrintPlane } from './parts/PrintPlane'

interface FloatingPreviewProps {
  texture: Texture
  printWidthM: number
  printHeightM: number
  /** White paper border around the image, in metres. The paper sheet
   *  bonded to Dibond is (print + 2 × border) on each axis. */
  paperBorderM: number
  mouldingWidthM: number
  mouldingDepthM: number
  frameMaterial: Material
  paperRoughness: number
}

// Visible coloured backboard border around the paper sheet, in metres.
// TPS exposes this as a per-side configurable "Mount Board Size" for
// Floating frames; for now we use a sane default so the preview reads
// correctly. Wire it up to a wizard dimension when we add that input.
const DEFAULT_BACKBOARD_BORDER_M = 0.02
// Always white. TPS's schematic documents that foamex comes in
// white or black, but their actual order flow only exposes white,
// so we don't surface a colour choice either.
const DEFAULT_BACKBOARD_HEX = '#f6f3ec'
// Plinth depth — the Dibond panel sits this far forward of the
// backboard. Small enough to hide behind the print head-on, large
// enough to give a depth cue at a slight camera angle.
const PLINTH_DEPTH_M = 0.004
// Match Standard's front-face z so the visible moulding silhouette
// stays consistent across frame types. See BoxPreview comment.
const FRAME_FRONT_Z = 0.02
// Z of the backboard plane. Kept shallow so the depth between print
// and backboard is small and the moulding's bottom-inner face is
// barely visible at the camera's angle — avoids visible banding.
const BACKBOARD_Z = -0.003

/**
 * Floating frame: print bonded to Dibond, suspended in front of a
 * visible coloured backboard with a uniform border on all four sides.
 * No passepartout, no paper border — the visible "border" around the
 * print is the backboard itself, not a window-cut mat.
 */
export const FloatingPreview = ({
  texture,
  printWidthM,
  printHeightM,
  paperBorderM,
  mouldingWidthM,
  mouldingDepthM,
  frameMaterial,
  paperRoughness,
}: FloatingPreviewProps) => {
  // Paper sheet bonded to Dibond — image + uniform paper border.
  const paperWidthM = printWidthM + paperBorderM * 2
  const paperHeightM = printHeightM + paperBorderM * 2

  // Backboard extends past the paper sheet by its own border.
  const backboardBorderM = DEFAULT_BACKBOARD_BORDER_M
  const backboardWidthM = paperWidthM + backboardBorderM * 2
  const backboardHeightM = paperHeightM + backboardBorderM * 2

  // Plinth slightly smaller than the paper sheet so any sliver of its
  // side wall is hidden behind the paper from a head-on camera.
  const plinthInsetM = 0.002
  const plinthWidthM = paperWidthM - plinthInsetM * 2
  const plinthHeightM = paperHeightM - plinthInsetM * 2

  return (
    <>
      <Backboard
        widthM={backboardWidthM}
        heightM={backboardHeightM}
        colorHex={DEFAULT_BACKBOARD_HEX}
        z={BACKBOARD_Z}
      />

      <Plinth
        widthM={plinthWidthM}
        heightM={plinthHeightM}
        depthM={PLINTH_DEPTH_M}
        colorHex={DEFAULT_BACKBOARD_HEX}
        frontZ={-0.0015}
      />

      {paperBorderM > 0 && (
        <PaperSheet widthM={paperWidthM} heightM={paperHeightM} roughness={paperRoughness} />
      )}

      <PrintPlane
        widthM={printWidthM}
        heightM={printHeightM}
        texture={texture}
        roughness={paperRoughness}
      />

      <group position={[0, 0, FRAME_FRONT_Z - mouldingDepthM]}>
        <Frame
          width={backboardWidthM + mouldingWidthM * 2}
          height={backboardHeightM + mouldingWidthM * 2}
          thickness={mouldingWidthM}
          depth={mouldingDepthM}
          material={frameMaterial}
          cornerStyle="mitered"
        />
      </group>
    </>
  )
}
