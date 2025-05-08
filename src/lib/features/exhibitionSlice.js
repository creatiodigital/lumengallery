import { createSlice } from '@reduxjs/toolkit'

const exhibitionSlice = createSlice({
  name: 'exhibition',
  initialState: {
    id: '',
    userId: '',
    name: '',
    mainTitle: '',
    url: '',
    thumbnailUrl: '',
    spaceId: '',
    bannerUrl: '',
    startDate: '',
    endDate: '',
    exhibitionArtworksById: {},
    allExhibitionArtworkIds: [],
    status: '',
    visibility: '',
  },
  reducers: {
    createArtworkPosition: (state, action) => {
      const { artworkId, artworkPosition } = action.payload

      if (!state.exhibitionArtworksById[artworkId]) {
        state.exhibitionArtworksById[artworkId] = artworkPosition

        if (!state.allExhibitionArtworkIds.includes(artworkId)) {
          state.allExhibitionArtworkIds.push(artworkId)
        }
      }
    },
    updateArtworkPosition: (state, action) => {
      const { artworkId, artworkPosition } = action.payload

      if (state.exhibitionArtworksById[artworkId]) {
        state.exhibitionArtworksById[artworkId] = {
          ...state.exhibitionArtworksById[artworkId],
          ...artworkPosition,
        }
      }
    },
    deleteArtworkPosition: (state, action) => {
      const { artworkId } = action.payload
      delete state.exhibitionArtworksById[artworkId]
      state.allExhibitionArtworkIds = state.allExhibitionArtworkIds.filter((id) => id !== artworkId)
    },
  },
})

export const { createArtworkPosition, updateArtworkPosition, deleteArtworkPosition } =
  exhibitionSlice.actions
export default exhibitionSlice.reducer
