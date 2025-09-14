import { createContext, type RefObject } from 'react'
import { Mesh } from 'three'

export type SceneContextValue = {
  wallRefs: RefObject<RefObject<Mesh | null>[]>
  windowRefs: RefObject<RefObject<Mesh | null>[]>
  glassRefs: RefObject<RefObject<Mesh | null>[]>
}

const SceneContext = createContext<SceneContextValue | undefined>(undefined)

export default SceneContext
