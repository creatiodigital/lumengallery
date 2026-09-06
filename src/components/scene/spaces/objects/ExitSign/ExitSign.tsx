import { useTexture } from '@react-three/drei'
import { Mesh, BufferGeometry } from 'three'

import { WallSign } from '@/components/scene/spaces/objects/WallSign'

/**
 * The exit sign mounted beside the corridor opening, telling a visitor which
 * way out is. Shared by every space, so the artwork lives in `public/` and is
 * served from the app origin — NOT via `assetUrl()`, which resolves to R2.
 * Shipping it with the code means it can never 404 from a missed upload.
 *
 * The GLB node name is a per-space convention: `leftExit0` in Paris and
 * Madrid, `exit0` in Vienna — pass `name` to override.
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

const ExitSign: React.FC<ExitSignProps> = ({ nodes, name = 'leftExit0' }) => (
  <WallSign nodes={nodes} name={name} texture={EXIT_SIGN_TEXTURE} />
)

export default ExitSign
