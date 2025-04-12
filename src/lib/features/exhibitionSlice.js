import { createSlice } from '@reduxjs/toolkit'

const exhibitionSlice = createSlice({
  name: 'exhibition',
  initialState: {
    artworksById: {
      test: {
        posX2d: '',
        posY2d: '',
        posZ2d: '',
        posX3d: '',
        posY3d: '',
        posZ3d: '',
        width: '',
        height: '',
      },
    },
    allArtworkIds: [],
  },
  reducers: {
    createArtworkPosition: (state, action) => {
      const { artworkId, artworkPosition } = action.payload

      if (!state.artworksById[artworkId]) {
        state.artworksById[artworkId] = artworkPosition

        if (!state.allArtworkIds.includes(artworkId)) {
          state.allArtworkIds.push(artworkId)
        }
      }
    },
    updateArtworkPosition: (state, action) => {
      const { artworkId, artworkPosition } = action.payload

      if (state.artworksById[artworkId]) {
        state.artworksById[artworkId] = {
          ...state.artworksById[artworkId],
          ...artworkPosition,
        }
      }
    },
  },
})

export const { createArtworkPosition, updateArtworkPosition } = exhibitionSlice.actions
export default exhibitionSlice.reducer
