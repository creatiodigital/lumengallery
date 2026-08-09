import { useTexture } from '@react-three/drei'
import { Mesh, BufferGeometry, SRGBColorSpace } from 'three'

/**
 * The exit sign mounted beside the corridor opening, telling a visitor which
 * way out is. Shared by every space, so the artwork lives in `public/` and is
 * served from the app origin — NOT via `assetUrl()`, which resolves to R2.
 * Shipping it with the code means it can never 404 from a missed upload.
 *
 * Geometry and placement come from the space's GLB (`leftExit0` by convention);
 * only the material is applied here, matching how walls, floors and ceilings
 * are handled — the GLB is exported with materials off.
 */
const EXIT_SIGN_TEXTURE = '/assets/signs/exit-green-left.png'

useTexture.preload(EXIT_SIGN_TEXTURE)

interface ExitSignProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  /** Node name in the GLB. Override only if a space names its sign differently. */
  name?: string
}

const ExitSign: React.FC<ExitSignProps> = ({ nodes, name = 'leftExit0' }) => {
  const texture = useTexture(EXIT_SIGN_TEXTURE)
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

export default ExitSign
