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
 *
 * Size lives in the GLB by design, which means the `leftExit0` quad and the
 * artwork must share an aspect ratio — the texture is stretched to fill the
 * quad, so a mismatch shows up as a squashed sign. Author the quad to match
 * whatever the PNG is exported at, in each space's GLB.
 */
/**
 * ⚠️ BUMP `?v=` WHENEVER THE ARTWORK CHANGES — even if the filename doesn't.
 * next.config.mjs serves `/assets/:path*` as `max-age=31536000, immutable`, so
 * without a new URL a returning visitor keeps the old sign for up to a year
 * (and locally the file appears not to update at all). Same convention the
 * space textures use: `bw2.jpg?v=2`.
 */
const EXIT_SIGN_TEXTURE = '/assets/signs/exit-black-left.png?v=1'

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
