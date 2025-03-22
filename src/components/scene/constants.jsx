import ClassicSpace from '@/components/scene/spaces/ClassicSpace/ClassicSpace'
import ModernSpace from '@/components/scene/spaces/ModernSpace/ModernSpace'

export const spaceComponents = {
  classic: ClassicSpace,
  modern: ModernSpace,
}

export const spaceRefsConfig = {
  classic: { walls: 1, windows: 2, glass: 2 },
  modern: { walls: 1 },
}
