import type { ExhibitionType } from './exhibition'

export type UserType = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
  userType: string
  email: string
}

export type UserStateType = UserType & {
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  exhibitionsById: Record<string, ExhibitionType>
  allExhibitionIds: string[]
}
