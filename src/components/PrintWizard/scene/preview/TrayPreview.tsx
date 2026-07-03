import type { Material, Texture } from 'three'

import Frame from '@/components/scene/spaces/objects/Frame/Frame'

import { PaperSheet } from './parts/PaperSheet'
import { Plinth } from './parts/Plinth'
import { PrintPlane } from './parts/PrintPlane'

interface TrayPreviewProps {
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

// Visible XY gap between the print's edge and the moulding's
// inner wall — the "tray slot". Looking through this slot you
// see the moulding-colored floor of the tray going down, which
// is the signature read that distinguishes Tray from Standard.
const TRAY_SLOT_M = 0.008

// Print sits ~5 mm below the moulding's front face for the
// recessed-into-the-frame feel.
const PRINT_FORWARD_Z = 0.015
// Visible floor of the tray cavity. Kept just in front of the
// wall plane (world z = 0; parent group is at ARTWORK_Z = 0.012)
// so the plate never clips into the wall.
const TRAY_FLOOR_Z = -0.008
// Plinth bridges the floor up to just behind the print so the
// print doesn't appear to float above the floor at angle.
const PLINTH_FRONT_Z = PRINT_FORWARD_Z - 0.002
const PLINTH_BACK_Z = TRAY_FLOOR_Z + 0.001
const PLINTH_DEPTH_M = PLINTH_FRONT_Z - PLINTH_BACK_Z
const PLINTH_INSET_M = 0.002
// Moulding's front face. Same as Standard / Box / Floating so the
// outer silhouette stays consistent across frame types — the extra
// tray depth extends backward behind the wall plane (hidden).
const FRAME_FRONT_Z = 0.02

/**
 * Tray frame: open-faced (no glass), Dibond-mounted print sits
 * inside a deep L-profile moulding. The print is recessed on Z
 * (sits behind the moulding's front face) AND inset on XY (sits
 * inboard of the moulding's inner wall), leaving a visible slot
 * all around the print. Through the slot you see the tray floor
 * and the moulding's inner walls in the frame's own color. No
 * mat, no paper border, no visible backboard around the print.
 */
export const TrayPreview = ({
  texture,
  printWidthM,
  printHeightM,
  paperBorderM,
  mouldingWidthM,
  mouldingDepthM,
  frameMaterial,
  paperRoughness,
}: TrayPreviewProps) => {
  // Paper sheet bonded to Dibond — image + uniform paper border.
  const paperWidthM = printWidthM + paperBorderM * 2
  const paperHeightM = printHeightM + paperBorderM * 2

  // Inner cavity dimensions — paper sheet plus the slot on each side.
  // (Slot sits between the paper, not the image, and the moulding.)
  const cavityWidthM = paperWidthM + TRAY_SLOT_M * 2
  const cavityHeightM = paperHeightM + TRAY_SLOT_M * 2

  // Plinth slightly smaller than the paper sheet so its side walls
  // hide behind the paper head-on but contribute depth at angle.
  const plinthWidthM = paperWidthM - PLINTH_INSET_M * 2
  const plinthHeightM = paperHeightM - PLINTH_INSET_M * 2

  return (
    <>
      {/* Tray floor — moulding-colored plate filling the cavity
          behind the paper sheet. Visible through the slot. */}
      <mesh position={[0, 0, TRAY_FLOOR_Z]}>
        <planeGeometry args={[cavityWidthM, cavityHeightM]} />
        <primitive object={frameMaterial} attach="material" />
      </mesh>

      {/* Plinth — dark support block bridging floor to paper sheet. */}
      <Plinth
        widthM={plinthWidthM}
        heightM={plinthHeightM}
        depthM={PLINTH_DEPTH_M}
        colorHex="#2a2a2a"
        frontZ={PLINTH_FRONT_Z}
      />

      {/* Paper sheet + image pushed forward to sit just behind the
          moulding's front face. The paper sits flush; the image is
          centered on it with the paper border showing around it. */}
      <group position={[0, 0, PRINT_FORWARD_Z]}>
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

      {/* Moulding wrapping the cavity. Inner opening is wider than
          the paper sheet by TRAY_SLOT_M per side so the slot stays
          visible. Front face anchored at FRAME_FRONT_Z; the deeper
          tray depth extends backward (occluded by the wall plane). */}
      <group position={[0, 0, FRAME_FRONT_Z - mouldingDepthM]}>
        <Frame
          width={cavityWidthM + mouldingWidthM * 2}
          height={cavityHeightM + mouldingWidthM * 2}
          thickness={mouldingWidthM}
          depth={mouldingDepthM}
          material={frameMaterial}
          cornerStyle="mitered"
        />
      </group>
    </>
  )
}
