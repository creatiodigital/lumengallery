'use client'

/**
 * Which room the visitor is standing in — so the other room's lights can be
 * switched off.
 *
 * three's forward renderer evaluates EVERY enabled light for every fragment. It
 * never culls lights by distance or frustum, so a lamp in a room you cannot see
 * costs exactly as much as one overhead. Vienna measured 22 spotlights at 6.8 ms
 * per frame — 39% of the whole frame — with half of them lighting a room that
 * was never on screen.
 *
 * This is safe precisely because a multi-room space is authored so the rooms are
 * never co-visible (the connecting corridor bends). Switching off the far room's
 * lights is therefore invisible, not a quality trade.
 *
 * A space with no room grouping — Paris, Madrid — gets a predicate that is always
 * true, so nothing changes for them.
 */

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'

import { groupNodesByRoom } from './nodeIndices'

/** Metres the next room must be closer by before we switch, so standing near a
 *  threshold cannot flap the lights on and off frame to frame. */
const HYSTERESIS = 2

type PositionedNode = { position?: { x: number; y: number; z: number } }

export const useActiveRoom = (
  nodes: Record<string, unknown>,
  prefix: string,
): ((index: number) => boolean) => {
  const groups = useMemo(() => groupNodesByRoom(nodes, prefix), [nodes, prefix])

  // Room centre = mean of its own nodes. No extra authoring needed, and it moves
  // with the model rather than drifting from a hardcoded coordinate.
  const centres = useMemo(
    () =>
      groups.map((g) => {
        const c = new Vector3()
        let n = 0
        for (const i of g.indices) {
          const p = (nodes[`${prefix}${i}`] as PositionedNode | undefined)?.position
          if (!p) continue
          c.add(new Vector3(p.x, p.y, p.z))
          n += 1
        }
        return n > 0 ? c.divideScalar(n) : c
      }),
    [groups, nodes, prefix],
  )

  // Culling is unconditional. Two earlier versions exempted the editor — first
  // the whole edit view, then just "while the lighting panel is open" — so that
  // an artist adjusting a lamp in the room they are NOT standing in would still
  // see it respond. Both were wrong in the same way: they made the editor the
  // one place where every light in the building is live (Vienna: 34 or 44
  // spotlights instead of 17 or 22), which is exactly where the space is
  // authored, judged, and profiled. An artist who wants to see a lamp respond
  // can walk into its room — that is one gesture, and it is the same thing a
  // visitor will see.
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const single = groups.length <= 1

  useFrame(({ camera }) => {
    if (single) return

    let nearest = activeRef.current
    let nearestDist = Infinity
    centres.forEach((c, i) => {
      const d = camera.position.distanceTo(c)
      if (d < nearestDist) {
        nearestDist = d
        nearest = i
      }
    })

    if (nearest === activeRef.current) return
    // Only switch once the new room is decisively closer.
    const currentDist = camera.position.distanceTo(centres[activeRef.current])
    if (currentDist - nearestDist < HYSTERESIS) return

    activeRef.current = nearest
    setActive(nearest)
  })

  return useMemo(() => {
    if (single) return () => true
    const activeIndices = new Set(groups[active]?.indices ?? [])
    return (index: number) => activeIndices.has(index)
  }, [single, groups, active])
}
