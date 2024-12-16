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
      const { wallId, id, canvas } = action.payload

      const wallArtworksCount = state.artworks.filter((artwork) => artwork.wallId === wallId).length

      const artworkName = `Artwork${wallArtworksCount + 1}`

      const newArtwork = {
        id,
        name: artworkName,
        wallId,
        canvas,
        space: [],
      }

      state.artworks.push(newArtwork)
    },
    editArtwork: (state, action) => {
      const { currentArtworkId, newArtworkSizes } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.canvas = {
          x: newArtworkSizes.x,
          y: newArtworkSizes.y,
          width: newArtworkSizes.width,
          height: newArtworkSizes.height,
        }
      }
    },
    deleteArtwork: (state, action) => {
      const { artworkId } = action.payload
      state.artworks = state.artworks.filter((artwork) => artwork.id !== artworkId)
    },
    editArtworkUrlImage: (state, action) => {
      const { currentArtworkId, url } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.url = url
      }
    },

    edit3DCoordinates: (state, action) => {
      const { currentArtworkId, serialized3DCoordinate } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.space = serialized3DCoordinate
      }
    },
    editArtworkName: (state, action) => {
      const { currentArtworkId, name } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.name = name
      }
    },
    editArtworkAuthor: (state, action) => {
      const { currentArtworkId, author } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.author = author
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
  deleteArtwork,
  editArtworkName,
  editArtworkAuthor,
} = artistSlice.actions
export default artistSlice.reducer
