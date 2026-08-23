import type { Material, Texture } from 'three'

import Frame from '@/components/scene/spaces/objects/Frame/Frame'

import { MatPlane } from './parts/MatPlane'
import { PaperSheet } from './parts/PaperSheet'
import { PrintPlane } from './parts/PrintPlane'

interface BoxPreviewProps {
  texture: Texture
  printWidthM: number
  printHeightM: number
  paperBorderM: number
  /** Vertical (top/bottom) paper border in metres. Defaults to
   *  `paperBorderM`. Differs only for fixed-sheet editions, where the sheet
   *  is a different shape from the image so the two axes diverge. */
  paperBorderYM?: number
  matBorderM: number
  matHex: string
  mouldingWidthM: number
  /** Box frames are deep — this is meaningfully larger than Standard. */
  mouldingDepthM: number
  frameMaterial: Material
  paperRoughness: number
}

// How far to recess the print + mat + paper stack back into the
// deeper moulding, in metres. Picked to stay safely in front of the
// wall (parent group sits at z = ARTWORK_Z = 0.012, wall at z = 0) so
// the recess never pushes the print plane through the wall.
const PRINT_RECESS_M = 0.009

// Where the moulding's FRONT face sits relative to the parent group's
// z (parent is at ARTWORK_Z = 0.012). Picked to match Standard so the
// visible silhouette stays consistent across frame types — Box's
// extra depth extends BEHIND the wall, hidden, instead of forward
// toward the camera where it would foreshorten and look thicker.
const FRAME_FRONT_Z = 0.02

/**
 * Box frame: same layered stack as Standard, but the moulding is
 * notably deeper (~2.5×) AND the print stack is recessed backward
 * inside that depth — the moulding's front face stays put, the
 * picture sits visibly deeper, reading as a "box" around the artwork.
 */
export const BoxPreview = ({
  texture,
  printWidthM,
  printHeightM,
  paperBorderM,
  paperBorderYM = paperBorderM,
  matBorderM,
  matHex,
  mouldingWidthM,
  mouldingDepthM,
  frameMaterial,
  paperRoughness,
}: BoxPreviewProps) => {
  const paperWidthM = printWidthM + paperBorderM * 2
  const paperHeightM = printHeightM + paperBorderYM * 2
  const matWidthM = paperWidthM + matBorderM * 2
  const matHeightM = paperHeightM + matBorderM * 2

  return (
    <>
      {/* Print stack recessed backward into the frame depth. */}
      <group position={[0, 0, -PRINT_RECESS_M]}>
        {matBorderM > 0 && <MatPlane widthM={matWidthM} heightM={matHeightM} colorHex={matHex} />}

        {paperBorderM > 0 && (
          <PaperSheet widthM={paperWidthM} heightM={paperHeightM} roughness={paperRoughness} />
        )}

        <PrintPlane
          widthM={printWidthM}
          heightM={printHeightM}
          texture={texture}
          roughness={paperRoughness}
        />
      </group>

      {/* Anchor the moulding's FRONT face at FRAME_FRONT_Z so the
          visible silhouette matches Standard. Extra depth extends
          backward into the wall (occluded), not toward the camera. */}
      <group position={[0, 0, FRAME_FRONT_Z - mouldingDepthM]}>
        <Frame
          width={matWidthM + mouldingWidthM * 2}
          height={matHeightM + mouldingWidthM * 2}
          thickness={mouldingWidthM}
          depth={mouldingDepthM}
          material={frameMaterial}
          cornerStyle="mitered"
        />
      </group>
    </>
  )
}
