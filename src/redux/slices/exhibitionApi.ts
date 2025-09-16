import type { TExhibition } from '@/types/exhibition'

import { baseApi } from './baseApi'

export const exhibitionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExhibitionsByUser: builder.query<TExhibition[], string>({
      query: (userId) => `exhibitions?userId=${userId}`,
    }),
    createExhibition: builder.mutation<
      TExhibition,
      {
        mainTitle: string
        visibility: string
        userId: string
        userHandler: string
        spaceId?: string
      }
    >({
      query: ({ mainTitle, visibility, userId, userHandler, spaceId }) => {
        const slugify = (str: string): string =>
          str
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/--+/g, '-')
            .trim()

        const handler = slugify(mainTitle)
        const url = `${userHandler}/${handler}`

        return {
          url: 'exhibitions',
          method: 'POST',
          body: { mainTitle, visibility, userId, handler, url, spaceId },
        }
      },
    }),
    deleteExhibition: builder.mutation<{ success: boolean; id: string }, string>({
      query: (id) => ({
        url: `exhibitions/${id}`,
        method: 'DELETE',
      }),
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetExhibitionsByUserQuery,
  useCreateExhibitionMutation,
  useDeleteExhibitionMutation,
} = exhibitionApi
