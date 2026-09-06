/**
 * How many of each prop a space has is a property of the MODEL, not of the code.
 *
 * Every prop family in a space GLB is a run of numbered nodes — `radiator0`,
 * `radiator1`, `trackLampArm0…13`. The components that render them used to be
 * told the count by hand (`<TrackLamp count={14} />`), which meant a space with
 * more props silently rendered only the first N and the rest were invisible with
 * no error. Reading the count off the model instead means a bigger space needs no
 * code change at all.
 *
 * Matching is anchored (`^prefix\d+$`) rather than `startsWith`, because prop
 * families share prefixes: `trackLampBody` and `trackLampBulb` both begin with
 * `trackLampB`, and a loose match would conflate them.
 */

/** Every index present for a prop family, ascending. Tolerates gaps. */
export const getNodeIndices = (nodes: Record<string, unknown>, prefix: string): number[] => {
  const pattern = new RegExp(`^${prefix}(\\d+)$`)
  const found: number[] = []
  for (const key of Object.keys(nodes)) {
    const match = pattern.exec(key)
    if (match) found.push(Number(match[1]))
  }
  return found.sort((a, b) => a - b)
}

/** How many nodes a prop family has. */
export const countNodes = (nodes: Record<string, unknown>, prefix: string): number =>
  getNodeIndices(nodes, prefix).length

/**
 * Group a prop family by the `room*` Empty each node is parented under.
 *
 * Must be called while the GLTF hierarchy is still intact — R3F's `<primitive>`
 * re-parents objects into its own graph when they mount, which destroys `.parent`.
 * Call it during the space component's render (before children mount) and keep
 * the result; don't re-derive it later.
 *
 * A space whose props sit at the scene root — Paris and Madrid — yields a single
 * group with `room: null`, so ungrouped spaces keep behaving exactly as before.
 */
/**
 * Room index from a parent Empty's name, or null if it isn't a room marker.
 *
 * Accepts both the bare form (`room0`) and a per-family suffix
 * (`trackLampsRoom0`, `roundLampsRoom1`, `recessedLampsRoom0`), so a Blender file
 * may group each prop family under its own Empty instead of putting everything
 * under one Empty per room.
 *
 * Deliberately case-insensitive. Hand-typing an Empty name per family per room
 * invites exactly one slip — `tracklampsRoom1` for `trackLampsRoom0` — and the
 * failure mode of a stricter match is silent: the lamps just quietly ungroup with
 * no error to notice. Tolerating case is cheaper than debugging that.
 */
const roomOf = (parentName?: string): number | null => {
  if (!parentName) return null
  const match = /room(\d+)$/i.exec(parentName)
  return match ? Number(match[1]) : null
}

/**
 * Room membership survives only as long as the GLB's parent chain does — and it
 * does not. The lamps are handed to `<primitive object={node} />`, so R3F adopts
 * those exact objects into its own graph and detaches them again on unmount,
 * while `useGLTF` keeps the node objects cached globally. The FIRST render after
 * a page load sees the authored parents; every later mount sees `parent === null`
 * and silently buckets every lamp into one anonymous group.
 *
 * That failure is invisible and expensive: the lighting panel loses its per-room
 * sections, and `useActiveRoom` sees `groups.length <= 1`, decides the space has
 * no rooms, and stops culling — so a two-room space quietly runs every light in
 * the building.
 *
 * So the first successful grouping is remembered per `nodes` object. Keyed by a
 * WeakMap, it dies with the GLTF cache entry. A collapsed result is deliberately
 * NOT cached: a genuinely ungrouped space (Paris, Madrid) simply recomputes a
 * short loop each time, and a space whose parents were already destroyed keeps
 * the chance to group correctly on a later call.
 */
const groupCache = new WeakMap<object, Map<string, { room: string | null; indices: number[] }[]>>()

export const groupNodesByRoom = (
  nodes: Record<string, { parent?: { name?: string } | null } | unknown>,
  prefix: string,
): { room: string | null; indices: number[] }[] => {
  const cached = groupCache.get(nodes)?.get(prefix)
  if (cached) return cached

  // Keyed by room INDEX, so the label is normalised on the way out and the
  // Blender naming convention never leaks into the UI.
  const byRoom = new Map<number | null, number[]>()

  for (const index of getNodeIndices(nodes, prefix)) {
    const node = nodes[`${prefix}${index}`] as { parent?: { name?: string } | null } | undefined
    const bucket = byRoom.get(roomOf(node?.parent?.name))
    if (bucket) bucket.push(index)
    else byRoom.set(roomOf(node?.parent?.name), [index])
  }

  // Ungrouped stays a single anonymous group; named rooms sort room0, room1, …
  const groups = [...byRoom.entries()]
    .sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : a - b))
    .map(([room, indices]) => ({ room: room === null ? null : `room${room}`, indices }))

  // Only a real grouping is worth remembering — see the note above.
  if (groups.some((g) => g.room !== null)) {
    let perPrefix = groupCache.get(nodes)
    if (!perPrefix) {
      perPrefix = new Map()
      groupCache.set(nodes, perPrefix)
    }
    perPrefix.set(prefix, groups)
  }

  return groups
}

/**
 * Collapse each node's ancestor transforms into the node itself.
 *
 * `<primitive object={node} />` hands the object to R3F, which re-parents it
 * into its own graph — so every transform above it in the GLB is discarded. For
 * a space whose props hang off a room Empty at the world origin that costs
 * nothing, which is why Paris and Madrid never noticed. Put that Empty anywhere
 * else and the whole family renders displaced by the Empty's offset: Vienna's
 * Room B measured ~21 m out.
 *
 * Rather than require every Blender file to keep its Empties at the origin
 * forever, bake the world transform down so the node carries it alone. Room
 * grouping is read from `.parent` before this runs (see `groupNodesByRoom`), so
 * membership is unaffected.
 *
 * Guarded by a WeakSet because `useGLTF` caches the parsed GLTF globally: the
 * same node objects survive unmount/remount, and applying this twice would
 * double the offset.
 */
const worldBaked = new WeakSet<object>()

type TransformNode = {
  parent?: TransformNode | null
  updateWorldMatrix?: (updateParents: boolean, updateChildren: boolean) => void
  matrixWorld?: { decompose: (p: unknown, q: unknown, s: unknown) => void }
  position?: unknown
  quaternion?: unknown
  scale?: unknown
}

export const bakeWorldTransforms = (
  nodes: Record<string, unknown>,
  prefixes: readonly string[],
): number => {
  const patterns = prefixes.map((p) => new RegExp(`^${p}\\d+$`))
  let baked = 0

  for (const [name, value] of Object.entries(nodes)) {
    if (!patterns.some((re) => re.test(name))) continue

    const node = value as TransformNode
    if (!node || worldBaked.has(node)) continue
    // Nothing above it — local already IS world.
    if (!node.parent || !node.updateWorldMatrix || !node.matrixWorld) continue

    node.updateWorldMatrix(true, false)
    node.matrixWorld.decompose(node.position, node.quaternion, node.scale)
    worldBaked.add(node)
    baked += 1
  }

  return baked
}

/**
 * How many collision refs a space needs, counted from its model.
 *
 * `Space.tsx` allocates the ref arrays before the space component mounts, so
 * these used to be hand-maintained numbers in the space registry — and a space
 * with more windows than its entry claimed simply had uncollidable glass, with
 * nothing to indicate why.
 *
 * Over-allocating is harmless: unused refs stay null and the collision raycast
 * filters them out. Under-allocating silently drops surfaces. So each family is
 * counted in full.
 */
export const deriveSpaceRefs = (nodes: Record<string, unknown>) => ({
  // Architecture walls, the invisible exit barrier, and radiators — every one is
  // a surface the camera must not walk through.
  walls:
    countNodes(nodes, 'wall') + countNodes(nodes, 'invisibleWall') + countNodes(nodes, 'radiator'),
  windows: countNodes(nodes, 'windowFrame'),
  glass: countNodes(nodes, 'windowGlass'),
})
