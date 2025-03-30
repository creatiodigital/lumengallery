import { createSlice } from '@reduxjs/toolkit'

const artworksSlice = createSlice({
  name: 'artworks',
  initialState: {
    id: '123456',
    name: 'Eduardo',
    artworks: [],
    artworkCounters: {
      paint: 0,
      text: 0,
    },
    walls: [],
  },
  reducers: {
    createArtwork: (state, action) => {
      const { wallId, id, canvas, artworkType } = action.payload

      if (artworkType in state.artworkCounters) {
        state.artworkCounters[artworkType] += 1
      } else {
        state.artworkCounters[artworkType] = 1
      }

      const artworkName = `${artworkType.charAt(0).toUpperCase() + artworkType.slice(1)} ${state.artworkCounters[artworkType]}`

      const newArtwork = {
        id,
        name: artworkName,
        artworkType,
        wallId,
        canvas,
        space: [],
        showFrame: false,
        url: '',
        showArtworkInformation: false,
        frameStyles: {
          frameColor: '#000000',
          frameThickness: { label: '1', value: 1 },
        },
        passepartoutStyles: {
          passepartoutColor: '#ffffff',
          passepartoutThickness: { label: '0', value: 0 },
        },
        artisticText: '',
        artisticTextStyles: {
          fontFamily: { label: 'Roboto', value: 'roboto' },
          fontSize: { label: '16', value: 16 },
          fontWeight: { label: 'Regular', value: 'regular' },
          letterSpacing: { label: '1', value: 1 },
          lineHeight: { label: '1', value: 1 },
          textColor: '#000000',
        },
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
    editAlignArtwork: (state, action) => {
      const { currentArtworkId, artworkPosition } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.canvas.x = artworkPosition.x
        artwork.canvas.y = artworkPosition.y
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
    showArtworkInformation: (state, action) => {
      const { currentArtworkId, showInformation } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.showArtworkInformation = showInformation
      }
    },
    editArtworkAuthor: (state, action) => {
      const { currentArtworkId, author } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.author = author
      }
    },
    editArtworkTitle: (state, action) => {
      const { currentArtworkId, artworkTitle } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.artworkTitle = artworkTitle
      }
    },
    editArtworkYear: (state, action) => {
      const { currentArtworkId, artworkYear } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.artworkYear = artworkYear
      }
    },
    editArtworkDescription: (state, action) => {
      const { currentArtworkId, description } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.description = description
      }
    },
    editArtworkDimensions: (state, action) => {
      const { currentArtworkId, artworkDimensions } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.artworkDimensions = artworkDimensions
      }
    },
    editArtworkArtisticText: (state, action) => {
      const { currentArtworkId, artisticText } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.artisticText = artisticText
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
    showArtworkPassepartout: (state, action) => {
      const { currentArtworkId, showPassepartout } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.showPassepartout = showPassepartout
      }
    },

    editArtworkText: (state, action) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        if (!artwork.artisticTextStyles) {
          artwork.artisticTextStyles = {}
        }
        artwork.artisticTextStyles[property] = value
      }
    },
    editArtworkFrame: (state, action) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        if (!artwork.frameStyles) {
          artwork.frameStyles = {}
        }
        artwork.frameStyles[property] = value
      }
    },
    editArtworkPassepartout: (state, action) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        if (!artwork.passepartoutStyles) {
          artwork.passepartoutStyles = {}
        }
        artwork.passepartoutStyles[property] = value
      }
    },
  },
})

export const {
  createArtwork,
  editArtwork,
  editAlignArtwork,
  editArtworkUrlImage,
  edit3DCoordinates,
  deleteArtwork,
  editArtworkName,
  editArtworkYear,
  editArtworkDimensions,
  editArtworkDescription,
  editArtworkArtisticText,
  editArtworkAuthor,
  editArtworkTitle,
  editArtworkTextAlign,
  showArtworkFrame,
  showArtworkPassepartout,
  showArtworkInformation,
  editArtworkFrame,
  editArtworkPassepartout,
  editArtworkText,
} = artworksSlice.actions
export default artworksSlice.reducer
