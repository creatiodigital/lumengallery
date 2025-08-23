import type { UserStateType } from '@/types/user'

export const createUserState = (): UserStateType => ({
  id: '',
  name: '',
  lastName: '',
  handler: '',
  biography: '',
  userType: '',
  email: '',
  status: 'idle',
  error: null,
  exhibitionsById: {},
  allExhibitionIds: [],
})
