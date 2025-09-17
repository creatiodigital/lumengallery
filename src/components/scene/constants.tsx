import ClassicSpace from '@/components/scene/spaces/ClassicSpace/ClassicSpace'
import ModernSpace from '@/components/scene/spaces/ModernSpace/ModernSpace'

export type SpaceKey = 'classic' | 'modern'

export type SpaceRefConfig = {
  walls?: number
  windows?: number
  glass?: number
}

export const spaceRefsConfig: Record<SpaceKey, SpaceRefConfig> = {
  classic: { walls: 1, windows: 2, glass: 2 },
  modern: { walls: 1 },
}

export const spaceComponents = {
  classic: ClassicSpace,
  modern: ModernSpace,
}
