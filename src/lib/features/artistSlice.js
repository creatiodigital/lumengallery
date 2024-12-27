import { createSlice } from '@reduxjs/toolkit'

const artistSlice = createSlice({
  name: 'artist',
  initialState: {
    id: '123456',
    name: 'Eduardo',
    lastName: 'Plaza',
    handler: '',
    artworks: [],
    artworkCounters: {
      paint: 0,
      text: 0,
    },
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
      const { wallId, id, canvas, artworkType } = action.payload

      if (artworkType in state.artworkCounters) {
        state.artworkCounters[artworkType] += 1
      } else {
        state.artworkCounters[artworkType] = 1
      }

      const artworkName = `${artworkType.charAt(0).toUpperCase() + artworkType.slice(1)}${state.artworkCounters[artworkType]}`

      const newArtwork = {
        id,
        name: artworkName,
        artworkType,
        wallId,
        canvas,
        space: [],
        showFrame: false,
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
    editArtworkDescription: (state, action) => {
      const { currentArtworkId, description } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.description = description
      }
    },
    editArtworkArtisticText: (state, action) => {
      const { currentArtworkId, artisticText } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.artisticText = artisticText
      }
    },
    editArtworkAuthor: (state, action) => {
      const { currentArtworkId, author } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.author = author
      }
    },
    editArtworkTextAlign: (state, action) => {
      const { currentArtworkId, textAlign } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        if (!artwork.artisticTextStyles) {
          artwork.artisticTextStyles = {}
        }
        artwork.artisticTextStyles.textAlign = textAlign
      }
    },
    showArtworkFrame: (state, action) => {
      const { currentArtworkId, showFrame } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.showFrame = showFrame
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
  editArtworkDescription,
  editArtworkArtisticText,
  editArtworkAuthor,
  editArtworkTextAlign,
  showArtworkFrame,
} = artistSlice.actions
export default artistSlice.reducer
