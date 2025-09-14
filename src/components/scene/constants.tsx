// constants.ts

import ClassicSpace from '@/components/scene/spaces/ClassicSpace/ClassicSpace'
import ModernSpace from '@/components/scene/spaces/ModernSpace/ModernSpace'

// 👇 Optional: Centralize space names
export type SpaceKey = 'classic' | 'modern'

// 👇 Properly typed config object
export type SpaceRefConfig = {
  walls?: number
  windows?: number
  glass?: number
}

// ✅ NAMED EXPORT
export const spaceRefsConfig: Record<SpaceKey, SpaceRefConfig> = {
  classic: { walls: 1, windows: 2, glass: 2 },
  modern: { walls: 1 },
}

// ✅ NAMED EXPORT
export const spaceComponents = {
  classic: ClassicSpace,
  modern: ModernSpace,
}
