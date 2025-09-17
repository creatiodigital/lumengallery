import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import type { TExhibition } from '@/types/exhibition'
import type { TUser } from '@/types/user'

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getUser: builder.query<TUser, string>({
      query: (id) => `users/${id}`,
    }),
    getExhibitionsByUser: builder.query<TExhibition[], string>({
      query: (userId) => `exhibitions?userId=${userId}`,
    }),
  }),
})

export const { useGetUserQuery, useGetExhibitionsByUserQuery } = api
