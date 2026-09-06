'use client'

import { useEffect } from 'react'

type Disposable = { dispose: () => void }

/**
 * Release a GPU object this component built itself — on unmount, or when it is
 * rebuilt with new settings.
 *
 * R3F disposes only what IT creates declaratively (`<meshStandardMaterial />`).
 * Anything constructed with `new ...` inside a `useMemo` and handed over as
 * `material={obj}` or `geometry={obj}` is foreign as far as R3F is concerned,
 * and is deliberately left alone — so it outlives every unmount. That is why
 * switching exhibitions stranded a fresh set of materials and geometries on the
 * GPU every time, each material also holding its compiled shader program: the
 * readout showed `programs` and `geometries` climbing and never coming back.
 * At 60 artworks a single visit leaves roughly 240 of each behind.
 *
 * Pass ONLY an object this component owns. Disposing something shared — a
 * module-level material, or geometry that came out of the GLTF cache — would
 * blank it for every other user of it.
 */
export const useDisposable = <T extends Disposable | null | undefined>(object: T): T => {
  useEffect(() => {
    if (!object) return
    return () => object.dispose()
  }, [object])
  return object
}

export default useDisposable
