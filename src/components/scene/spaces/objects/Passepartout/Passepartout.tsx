import { useMemo } from 'react'
import { Shape, ExtrudeGeometry, Material } from 'three'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

interface PassepartoutProps {
  width: number
  height: number
  thickness: number // This is the border width, not depth
  depth?: number // Z-depth (how much it protrudes)
  material: Material
}

const BEVEL_SEGMENTS = 2

/**
 * Create a mitered passepartout piece using Shape + ExtrudeGeometry.
 * The shape is a trapezoid (mitered at 45° on both ends).
 */
function createMiteredPieceGeo(length: number, thickness: number, depth: number): ExtrudeGeometry {
  const halfLen = length / 2
  const t = thickness

  // Dynamic bevel: proportional to thickness, kept very small to avoid corner artifacts
  const bevelSize = Math.min(thickness * 0.02, 0.0008)
  const bevelThickness = Math.min(thickness * 0.01, 0.0004)

  const shape = new Shape()
  shape.moveTo(-halfLen, 0)
  shape.lineTo(halfLen, 0)
  shape.lineTo(halfLen - t, -t)
  shape.lineTo(-halfLen + t, -t)
  shape.closePath()

  const geo = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize,
    bevelThickness,
    bevelSegments: BEVEL_SEGMENTS,
  })

  geo.translate(0, 0, -depth / 2)

  // Normalize UVs to 0-1 range for correct texture mapping.
  const uvAttr = geo.getAttribute('uv')
  if (uvAttr) {
    let minU = Infinity,
      maxU = -Infinity,
      minV = Infinity,
      maxV = -Infinity
    for (let i = 0; i < uvAttr.count; i++) {
      const u = uvAttr.getX(i)
      const v = uvAttr.getY(i)
      if (u < minU) minU = u
      if (u > maxU) maxU = u
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }
    const rangeU = maxU - minU || 1
    const rangeV = maxV - minV || 1
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setX(i, (uvAttr.getX(i) - minU) / rangeU)
      uvAttr.setY(i, (uvAttr.getY(i) - minV) / rangeV)
    }
    uvAttr.needsUpdate = true
  }

  return geo
}

const Passepartout: React.FC<PassepartoutProps> = ({
  width,
  height,
  thickness,
  depth = 0.02,
  material,
}) => {
  // Passepartout sits ON TOP of the artwork/support, extending forward (positive Z)
  // The back face touches the support surface, mat body extends toward viewer
  const zOffset = depth / 2

  const { topGeo, leftGeo } = useMemo(() => {
    const hGeo = createMiteredPieceGeo(width, thickness, depth)
    const vGeo = createMiteredPieceGeo(height, thickness, depth)
    return { topGeo: hGeo, leftGeo: vGeo }
  }, [width, height, thickness, depth])
  useDisposable(topGeo)
  useDisposable(leftGeo)

  return (
    <group position={[0, 0, zOffset]}>
      {/* Top */}
      <mesh
        geometry={topGeo}
        material={material}
        castShadow
        receiveShadow
        position={[0, height / 2, 0]}
      />
      {/* Bottom */}
      <mesh
        geometry={topGeo}
        material={material}
        castShadow
        receiveShadow
        position={[0, -height / 2, 0]}
        rotation={[0, 0, Math.PI]}
      />
      {/* Right */}
      <mesh
        geometry={leftGeo}
        material={material}
        castShadow
        receiveShadow
        position={[width / 2, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      />
      {/* Left */}
      <mesh
        geometry={leftGeo}
        material={material}
        castShadow
        receiveShadow
        position={[-width / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      />
    </group>
  )
}

export default Passepartout
