import type { Material, Texture } from 'three'

import Frame from '@/components/scene/spaces/objects/Frame/Frame'

import { MatPlane } from './parts/MatPlane'
import { PaperSheet } from './parts/PaperSheet'
import { PrintPlane } from './parts/PrintPlane'

interface StandardPreviewProps {
  texture: Texture
  /** Print dimensions in metres. */
  printWidthM: number
  printHeightM: number
  /** White paper border around the print (same sheet). 0 = none. */
  paperBorderM: number
  /** Passepartout border. 0 = no mat. */
  matBorderM: number
  matHex: string
  /** Moulding face width (XY). */
  mouldingWidthM: number
  /** Moulding depth (Z). Standard frames are shallow. */
  mouldingDepthM: number
  frameMaterial: Material
  paperRoughness: number
}

// Lift the artwork stack toward the front of the moulding so when the
// buyer tilts the scene they see only a tiny lip overhang — matches
// real Standard frames where the print sits ~3mm behind the moulding
// face under glass. Without this the stack ends up ~20mm behind the
// front face, which reads as a Box frame instead of Standard.
const PRINT_FORWARD_M = 0.017

/**
 * Standard / Traditional frame: print behind a thin moulding with a
 * subtle front lip, optional passepartout mat, optional paper border.
 * Shallow depth — the print sits close to the moulding face.
 */
export const StandardPreview = ({
  texture,
  printWidthM,
  printHeightM,
  paperBorderM,
  matBorderM,
  matHex,
  mouldingWidthM,
  mouldingDepthM,
  frameMaterial,
  paperRoughness,
}: StandardPreviewProps) => {
  const paperWidthM = printWidthM + paperBorderM * 2
  const paperHeightM = printHeightM + paperBorderM * 2
  const matWidthM = paperWidthM + matBorderM * 2
  const matHeightM = paperHeightM + matBorderM * 2

  return (
    <>
      {/* Artwork stack sits just behind the moulding's front face. */}
      <group position={[0, 0, PRINT_FORWARD_M]}>
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

      {/* Moulding wrapping the stack. Front face stays at the same
          world-z as Box / Floating so the silhouette is consistent. */}
      <group position={[0, 0, -0.002]}>
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
