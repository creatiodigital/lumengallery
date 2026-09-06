import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Mesh, BufferGeometry } from 'three'
import type { RootState } from '@/redux/store'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { countNodes } from '@/components/scene/spaces/objects/nodeIndices'

const DEFAULT_WINDOW_LIGHT_INTENSITY = 4.0
const DEFAULT_WINDOW_LIGHT_COLOR = '#ffffff'

interface ParisWindowProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  frameCount?: number
  glassCount?: number
  handleCount?: number
  windowRefs?: React.RefObject<Mesh | null>[]
  glassRefs?: React.RefObject<Mesh | null>[]
}

const ParisWindow: React.FC<ParisWindowProps> = ({
  nodes,
  frameCount,
  glassCount,
  handleCount,
  windowRefs,
  glassRefs,
}) => {
  const windowLightIntensity = useSelector(
    (state: RootState) => state.exhibition.windowLightIntensity ?? DEFAULT_WINDOW_LIGHT_INTENSITY,
  )
  const windowLightColor = useSelector(
    (state: RootState) => state.exhibition.windowLightColor ?? DEFAULT_WINDOW_LIGHT_COLOR,
  )
  const windowTransparency = useSelector(
    (state: RootState) => state.exhibition.windowTransparency ?? false,
  )

  // Tinted colors that respond to ambient light (NOT for glass)
  const tintedFrame = useAmbientLightColor('#e8e8e8')
  const tintedHandle = useAmbientLightColor('#8d8d8a')

  // Counts come from the GLB unless a space deliberately overrides them.
  const frames = frameCount ?? countNodes(nodes, 'windowFrame')
  const glass = glassCount ?? countNodes(nodes, 'windowGlass')
  const handles = handleCount ?? countNodes(nodes, 'windowHandle')

  const framesArray = useMemo(() => Array.from({ length: frames }), [frames])
  const glassArray = useMemo(() => Array.from({ length: glass }), [glass])
  const handlesArray = useMemo(() => Array.from({ length: handles }), [handles])

  return (
    <>
      {/* Window Glass - always render for collision, hide visually when transparent */}
      {glassArray.map((_, i) => {
        const glassNode = nodes[`windowGlass${i}`]
        if (!glassNode) return null
        return (
          <mesh
            key={`glass-${i}`}
            ref={glassRefs?.[i]}
            name={`windowGlass${i}`}
            geometry={glassNode.geometry}
            visible={!windowTransparency}
            position={[
              glassNode.position.x,
              glassNode.position.y,
              glassNode.position.z - 0.05, // Push back behind frames
            ]}
            rotation={glassNode.rotation}
            scale={glassNode.scale}
          >
            <meshStandardMaterial
              color={windowLightColor}
              emissive={windowLightColor}
              emissiveIntensity={windowLightIntensity * 0.3}
              envMapIntensity={0}
            />
          </mesh>
        )
      })}

      {/* Window Frames */}
      {framesArray.map((_, i) => {
        const frameNode = nodes[`windowFrame${i}`]
        if (!frameNode) return null
        return (
          <mesh
            key={`frame-${i}`}
            ref={windowRefs?.[i]}
            name={`windowFrame${i}`}
            geometry={frameNode.geometry}
            position={frameNode.position}
            rotation={frameNode.rotation}
            scale={frameNode.scale}
          >
            <meshStandardMaterial color={tintedFrame} roughness={0.5} />
          </mesh>
        )
      })}

      {/* Window Handles */}
      {handlesArray.map((_, i) => {
        const handleNode = nodes[`windowHandle${i}`]
        if (!handleNode) return null
        return (
          <mesh
            key={`handle-${i}`}
            name={`windowHandle${i}`}
            geometry={handleNode.geometry}
            position={handleNode.position}
            rotation={handleNode.rotation}
            scale={handleNode.scale}
          >
            <meshStandardMaterial color={tintedHandle} roughness={0.3} metalness={0.9} />
          </mesh>
        )
      })}
    </>
  )
}

export default ParisWindow
