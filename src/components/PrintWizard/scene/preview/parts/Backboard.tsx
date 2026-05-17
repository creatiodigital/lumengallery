interface BackboardProps {
  widthM: number
  heightM: number
  colorHex: string
  z?: number
}

/**
 * Visible coloured backboard for Floating frames — the Dibond-mounted
 * print sits proud of this on a plinth, so the backboard's colour
 * shows as a border on all four sides. White or black per TPS.
 */
export const Backboard = ({ widthM, heightM, colorHex, z = -0.005 }: BackboardProps) => (
  <mesh position={[0, 0, z]}>
    <planeGeometry args={[widthM, heightM]} />
    <meshStandardMaterial color={colorHex} roughness={0.92} />
  </mesh>
)
