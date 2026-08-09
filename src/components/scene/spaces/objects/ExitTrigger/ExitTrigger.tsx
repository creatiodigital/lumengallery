import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Box3, Mesh, Object3D, Vector3 } from 'three'

import { openExitPrompt } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'

/**
 * Raises the "Leave the exhibition?" confirmation when a visitor reaches the
 * end of the exit corridor, so leaving is always a decision rather than a
 * consequence of wandering. Renders nothing.
 *
 * Keyed to the invisible wall that physically stops the camera at the end of
 * the exit corridor. One authored object does both jobs: it blocks, and getting
 * near it asks. That is deliberately simpler than the plane-and-markers version
 * it replaced — a plane has to be positioned by coordinates, is infinite, and
 * in a corridor that bends can be approached from the wrong side or slipped
 * past sideways. A mesh is placed by eye in Blender, blocks from every
 * direction, and cannot be walked around.
 *
 * So a space needs exactly two authored things: `initialPoint0` (arrival, and
 * where "Stay" returns the visitor) and the wall. A space without one simply
 * never fires — the corner close button still works.
 */

/** How close to the wall the visitor gets before being asked, in metres.
 *  Roughly a stride, so the prompt lands as they reach it rather than after
 *  they have already stopped against something invisible. */
const PROMPT_DISTANCE = 1.2

interface ExitTriggerProps {
  nodes: Record<string, (Mesh | Object3D) & { position: Vector3 }>
  /** Node name of the barrier. Override only if a space names its wall differently. */
  name?: string
}

const ExitTrigger: React.FC<ExitTriggerProps> = ({ nodes, name = 'invisibleWall0' }) => {
  const dispatch = useDispatch()
  const camera = useThree((state) => state.camera)

  const isExitPromptOpen = useSelector((state: RootState) => state.scene.isExitPromptOpen)
  const respawnNonce = useSelector((state: RootState) => state.scene.exitRespawnNonce)
  const initialCameraPosition = useSelector((state: RootState) => state.scene.initialCameraPosition)
  const initialCameraDirection = useSelector(
    (state: RootState) => state.scene.initialCameraDirection,
  )
  const cameraElevation = useSelector((state: RootState) => state.exhibition.cameraElevation ?? 1.6)

  // World-space bounding box of the barrier, computed once. Distance-to-box
  // copes with any rotation or scale, so the wall can be angled to suit the
  // corridor. `updateMatrixWorld` first: these nodes come straight from the
  // GLTF and are not the instances React renders, so their world matrices are
  // not otherwise refreshed and the box would land at the origin.
  const wallBox = useMemo(() => {
    const wall = nodes[name]
    if (!wall) {
      // Loud in dev, because the usual cause is a stale GLB: re-exporting under
      // the same filename leaves both the HTTP cache and drei's GLTF cache
      // serving the previous bytes, so a newly added barrier silently is not
      // there. Without this it just looks like the feature is broken.
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[ExitTrigger] no "${name}" node in this space — the exit prompt will never fire. ` +
            `Nodes present: ${Object.keys(nodes).sort().join(', ')}`,
        )
      }
      return null
    }
    wall.updateMatrixWorld(true)
    return new Box3().setFromObject(wall)
  }, [nodes, name])

  // Declined to leave: put the visitor back where they started, facing the way
  // they first faced — the same placement the GLB's initialPoint gives on
  // arrival, so "stay" lands somewhere familiar rather than mid-corridor.
  useEffect(() => {
    if (respawnNonce === 0 || !initialCameraPosition || !initialCameraDirection) return
    const [px, pz] = initialCameraPosition
    const [dx, dz] = initialCameraDirection
    camera.position.set(px, cameraElevation, pz)
    camera.lookAt(new Vector3(px + dx, cameraElevation, pz + dz))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respawnNonce])

  useFrame(() => {
    if (!wallBox || isExitPromptOpen) return
    if (wallBox.distanceToPoint(camera.position) <= PROMPT_DISTANCE) dispatch(openExitPrompt())
  })

  return null
}

export default ExitTrigger
