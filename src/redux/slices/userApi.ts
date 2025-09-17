import type { TUser } from '@/types/user'

import { baseApi } from './baseApi'

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUser: builder.query<TUser, string>({
      query: (id) => `users/${id}`,
    }),
  }),
  overrideExisting: false,
})

export const { useGetUserQuery } = userApi
