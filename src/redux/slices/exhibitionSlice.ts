import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { exhibitionFactory } from '@/factories/exhibitionFactory'
import type { ArtworkPositionType } from '@/types/artwork'
import type { ExhibitionType } from '@/types/exhibition'

const exhibitionSlice = createSlice({
  name: 'exhibition',
  initialState: exhibitionFactory(),
  reducers: {
    createArtworkPosition: (
      state: ExhibitionType,
      action: PayloadAction<{ artworkId: string; artworkPosition: ArtworkPositionType }>,
    ) => {
      const { artworkId, artworkPosition } = action.payload

      if (!state.exhibitionArtworksById[artworkId]) {
        state.exhibitionArtworksById[artworkId] = artworkPosition

        if (!state.allExhibitionArtworkIds.includes(artworkId)) {
          state.allExhibitionArtworkIds.push(artworkId)
        }
      }
    },

    updateArtworkPosition: (
      state: ExhibitionType,
      action: PayloadAction<{ artworkId: string; artworkPosition: Partial<ArtworkPositionType> }>,
    ) => {
      const { artworkId, artworkPosition } = action.payload

      if (state.exhibitionArtworksById[artworkId]) {
        state.exhibitionArtworksById[artworkId] = {
          ...state.exhibitionArtworksById[artworkId],
          ...artworkPosition,
        }
      }
    },

    deleteArtworkPosition: (
      state: ExhibitionType,
      action: PayloadAction<{ artworkId: string }>,
    ) => {
      const { artworkId } = action.payload
      delete state.exhibitionArtworksById[artworkId]
      state.allExhibitionArtworkIds = state.allExhibitionArtworkIds.filter((id) => id !== artworkId)
    },
  },
})

export const { createArtworkPosition, updateArtworkPosition, deleteArtworkPosition } =
  exhibitionSlice.actions

export default exhibitionSlice.reducer
