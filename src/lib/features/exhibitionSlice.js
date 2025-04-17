import { createSlice } from '@reduxjs/toolkit'

const exhibitionSlice = createSlice({
  name: 'exhibition',
  initialState: {
    positionsById: {
      test: {
        posX2d: '',
        posY2d: '',
        posX3d: '',
        posY3d: '',
        posZ3d: '',
        width2d: '',
        height2d: '',
        width3d: '',
        height3d: '',
        quaternionX: '',
        quaternionZ: '',
        quaternionY: '',
        quaternionZ: '',
      },
    },
    allPositionIds: [],
  },
  reducers: {
    createArtworkPosition: (state, action) => {
      const { artworkId, artworkPosition } = action.payload

      if (!state.positionsById[artworkId]) {
        state.positionsById[artworkId] = artworkPosition

        if (!state.allPositionIds.includes(artworkId)) {
          state.allPositionIds.push(artworkId)
        }
      }
    },
    updateArtworkPosition: (state, action) => {
      const { artworkId, artworkPosition } = action.payload

      if (state.positionsById[artworkId]) {
        state.positionsById[artworkId] = {
          ...state.positionsById[artworkId],
          ...artworkPosition,
        }
      }
    },
  },
})

export const { createArtworkPosition, updateArtworkPosition } = exhibitionSlice.actions
export default exhibitionSlice.reducer
