import { createContext, type RefObject } from 'react'
import { Mesh } from 'three'

export type SceneContextValue = {
  wallRefs: RefObject<Mesh>[]
  windowRefs: RefObject<Mesh>[]
  glassRefs: RefObject<Mesh>[]
}

const SceneContext = createContext<SceneContextValue | undefined>(undefined)

export default SceneContext
