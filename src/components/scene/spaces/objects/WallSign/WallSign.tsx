import { useTexture } from '@react-three/drei'
import { Mesh, BufferGeometry, SRGBColorSpace } from 'three'

/**
 * Shared renderer for the flat wayfinding signs mounted on the gallery walls —
 * `ExitSign` and `ContinueSign`. They differ only in artwork and node name, so
 * the material handling lives here once: the flipY correction and the unlit
 * setup below are subtle enough that two copies would eventually drift.
 *
 * Geometry and placement come from the space's GLB; only the material is
 * applied here, matching how walls, floors and ceilings are handled — the GLB
 * is exported with materials off.
 *
 * Size lives in the GLB by design, which means the sign quad and the artwork
 * must share an aspect ratio — the texture is stretched to fill the quad, so a
 * mismatch shows up as a squashed sign. Author the quad to match whatever the
 * PNG is exported at, in each space's GLB.
 */
interface WallSignProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  /** Node name in the GLB. */
  name: string
  /** Artwork URL, served from the app origin. */
  texture: string
}

const WallSign: React.FC<WallSignProps> = ({ nodes, name, texture: textureUrl }) => {
  const texture = useTexture(textureUrl)
  texture.colorSpace = SRGBColorSpace
  // TextureLoader defaults to flipY = true (the WebGL image convention), but
  // the UVs baked into the GLB follow glTF's top-left origin. Without this the
  // sign renders vertically mirrored.
  texture.flipY = false
  texture.needsUpdate = true

  const node = nodes[name]
  if (!node) return null

  return (
    <mesh
      name={name}
      geometry={node.geometry}
      position={node.position}
      rotation={node.rotation}
      scale={node.scale}
    >
      {/* Unlit on purpose: signage must stay legible regardless of how the
          room is lit, and `toneMapped={false}` keeps the printed colours true
          under the scene's tone mapping. `transparent` honours the PNG alpha. */}
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}

export default WallSign
