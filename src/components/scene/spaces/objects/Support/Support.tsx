import { useMemo } from 'react'
import { Shape, ExtrudeGeometry, MeshStandardMaterial } from 'three'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

interface SupportProps {
  width: number
  height: number
  depth: number // Thickness/depth of the support in scene units
  material: MeshStandardMaterial
}

/**
 * Support component - renders the canvas/panel depth behind an artwork
 * This is the physical painting surface (stretcher bars, wood panel, etc.)
 */
const Support: React.FC<SupportProps> = ({ width, height, depth, material }) => {
  const geometry = useMemo(() => {
    // Create a simple box shape for the support
    const shape = new Shape()
    const halfW = width / 2
    const halfH = height / 2

    // Draw rectangle centered at origin
    shape.moveTo(-halfW, -halfH)
    shape.lineTo(halfW, -halfH)
    shape.lineTo(halfW, halfH)
    shape.lineTo(-halfW, halfH)
    shape.closePath()

    // Extrude forward from Z=0
    const extrudeSettings = {
      steps: 1,
      depth: depth,
      bevelEnabled: false,
    }

    return new ExtrudeGeometry(shape, extrudeSettings)
  }, [width, height, depth])
  useDisposable(geometry)

  // Position so back face is at Z=0 (wall) and support extends forward toward viewer
  // ExtrudeGeometry creates shape at Z=0 and extrudes to Z=depth
  return (
    <mesh geometry={geometry} material={material} position={[0, 0, 0]} castShadow receiveShadow />
  )
}

export default Support
