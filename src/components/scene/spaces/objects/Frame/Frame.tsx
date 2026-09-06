import { useMemo } from 'react'
import { Shape, ExtrudeGeometry, Material } from 'three'
import { RoundedBox } from '@react-three/drei'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

interface FrameProps {
  width: number
  height: number
  thickness: number // Border width (XY)
  depth?: number // Z-depth (how much it protrudes)
  material: Material
  cornerStyle?: 'mitered' | 'straight' // 'mitered' = 45° angled, 'straight' = butt joint
}

const BEVEL_SEGMENTS = 2
const ROUNDED_BEVEL_RADIUS = 0.002

/**
 * Create a mitered frame piece using Shape + ExtrudeGeometry.
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

  // Normalize UVs to 0-1 range so normal/roughness maps sample correctly.
  // ExtrudeGeometry generates UVs in world-space coordinates (e.g. 0-0.05m)
  // which is too small a range for the texture maps.
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

/** Mitered frame — 45° corner joints */
const MiteredFrame = ({
  width,
  height,
  thickness,
  depth,
  material,
}: Omit<FrameProps, 'cornerStyle'>) => {
  const d = depth!

  const { topGeo, leftGeo } = useMemo(() => {
    const hGeo = createMiteredPieceGeo(width, thickness, d)
    const vGeo = createMiteredPieceGeo(height, thickness, d)
    return { topGeo: hGeo, leftGeo: vGeo }
  }, [width, height, thickness, d])
  useDisposable(topGeo)
  useDisposable(leftGeo)

  return (
    <group position={[0, 0, d / 2]}>
      <mesh
        geometry={topGeo}
        material={material}
        castShadow
        receiveShadow
        position={[0, height / 2, 0]}
      />
      <mesh
        geometry={topGeo}
        material={material}
        castShadow
        receiveShadow
        position={[0, -height / 2, 0]}
        rotation={[0, 0, Math.PI]}
      />
      <mesh
        geometry={leftGeo}
        material={material}
        castShadow
        receiveShadow
        position={[width / 2, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      />
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

/** Straight frame — butt joint corners (top/bottom fit between left/right) */
const StraightFrame = ({
  width,
  height,
  thickness,
  depth,
  material,
}: Omit<FrameProps, 'cornerStyle'>) => {
  const d = depth!
  const innerWidth = width - thickness * 2

  return (
    <group position={[0, 0, d / 2]}>
      <RoundedBox
        args={[thickness, height, d]}
        radius={ROUNDED_BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[-(width / 2 - thickness / 2), 0, 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>
      <RoundedBox
        args={[thickness, height, d]}
        radius={ROUNDED_BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[width / 2 - thickness / 2, 0, 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>
      <RoundedBox
        args={[innerWidth, thickness, d]}
        radius={ROUNDED_BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[0, height / 2 - thickness / 2, 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>
      <RoundedBox
        args={[innerWidth, thickness, d]}
        radius={ROUNDED_BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[0, -(height / 2 - thickness / 2), 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>
    </group>
  )
}

const Frame: React.FC<FrameProps> = ({
  width,
  height,
  thickness,
  depth = 0.01,
  material,
  cornerStyle = 'mitered',
}) => {
  if (cornerStyle === 'straight') {
    return (
      <StraightFrame
        width={width}
        height={height}
        thickness={thickness}
        depth={depth}
        material={material}
      />
    )
  }
  return (
    <MiteredFrame
      width={width}
      height={height}
      thickness={thickness}
      depth={depth}
      material={material}
    />
  )
}

export default Frame
