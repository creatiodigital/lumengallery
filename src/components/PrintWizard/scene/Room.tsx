'use client'

/**
 * Minimal backdrop: a single frontal wall plane.
 * Kept deliberately simple.
 */
export const Room = () => {
  return (
    // Oversized wall so wide/ultrawide canvases (when the wizard's center
    // column fills the viewport) never show past the plane's edges.
    <mesh position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[16, 6]} />
      <meshStandardMaterial color="#dcd5c8" roughness={0.95} />
    </mesh>
  )
}
