import { createSlice } from '@reduxjs/toolkit'

const artistSlice = createSlice({
  name: 'artist',
  initialState: {
    id: '123456',
    name: 'Eduardo',
    lastName: 'Plaza',
    handler: '',
    artworks: [],
  },
  reducers: {
    setHandler: (state, action) => {
      state.handler = action.payload
    },
    showEditMode: (state) => {
      state.isEditMode = true
    },
    hideEditMode: (state) => {
      state.isEditMode = false
    },
    createArtwork: (state, action) => {
      const newArtwork = {
        id: action.payload.id,
        wallId: action.payload.wallId,
        canvas: {
          x: action.payload.canvas.x,
          y: action.payload.canvas.y,
          width: action.payload.canvas.width,
          height: action.payload.canvas.height,
        },
        space: [],
      }
      state.artworks.push(newArtwork)
    },
    editArtwork: (state, action) => {
      const { currentArtworkId, newArtworkSizes } = action.payload
      const artwork = state.artworks.find(
        (artwork) => artwork.id === currentArtworkId,
      )
      if (artwork) {
        artwork.canvas = {
          x: newArtworkSizes.x,
          y: newArtworkSizes.y,
          width: newArtworkSizes.width,
          height: newArtworkSizes.height,
        }
      }
    },
    editArtworkUrlImage: (state, action) => {
      const { currentArtworkId, url } = action.payload
      const artwork = state.artworks.find(
        (artwork) => artwork.id === currentArtworkId,
      )
      if (artwork) {
        artwork.url = url
      }
    },

    edit3DCoordinates: (state, action) => {
      const { currentArtworkId, serialized3DCoordinate } = action.payload
      const artwork = state.artworks.find(
        (artwork) => artwork.id === currentArtworkId,
      )
      if (artwork) {
        artwork.space = serialized3DCoordinate
      }
    },
  },
})

export const {
  showEditMode,
  hideEditMode,
  setHandler,
  createArtwork,
  editArtwork,
  editArtworkUrlImage,
  edit3DCoordinates,
} = artistSlice.actions
export default artistSlice.reducer
