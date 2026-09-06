import { useTexture } from '@react-three/drei'
import { Mesh, BufferGeometry } from 'three'

import { WallSign } from '@/components/scene/spaces/objects/WallSign'

/**
 * The "continue the exhibition" sign, pointing a visitor onward from one room
 * to the next rather than out of the gallery — the counterpart to `ExitSign`.
 * The artwork lives in `public/` and is served from the app origin, NOT via
 * `assetUrl()`, which resolves to R2: shipping it with the code means it can
 * never 404 from a missed upload.
 *
 * Only Vienna authors this node today (`continue0`); Paris and Madrid have no
 * onward room to point at, so they simply do not render the component.
 */
/**
 * ⚠️ BUMP `?v=` WHENEVER THE ARTWORK CHANGES — even if the filename doesn't.
 * next.config.mjs serves `/assets/:path*` as `max-age=31536000, immutable`, so
 * without a new URL a returning visitor keeps the old sign for up to a year
 * (and locally the file appears not to update at all). Same convention the
 * space textures use: `bw2.jpg?v=2`.
 */
const CONTINUE_SIGN_TEXTURE = '/assets/signs/continue-right.png?v=1'

useTexture.preload(CONTINUE_SIGN_TEXTURE)

interface ContinueSignProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  /** Node name in the GLB. Override only if a space names its sign differently. */
  name?: string
}

const ContinueSign: React.FC<ContinueSignProps> = ({ nodes, name = 'continue0' }) => (
  <WallSign nodes={nodes} name={name} texture={CONTINUE_SIGN_TEXTURE} />
)

export default ContinueSign
