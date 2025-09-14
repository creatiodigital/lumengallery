import type { TUserState } from '@/types/user'

export const createUserState = (): TUserState => ({
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
