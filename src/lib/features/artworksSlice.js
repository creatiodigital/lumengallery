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
        author: '',
        title: '',
        year: '',
        description: '',
        dimensions: '',
        artisticImageProperties: {
          imageUrl: '',
          showArtworkInformation: false,
          showFrame: false,
          frameColor: '#000000',
          frameThickness: { label: '1', value: 1 },
          showPassepartout: false,
          passepartoutColor: '#ffffff',
          passepartoutThickness: { label: '0', value: 0 },
        },
        artisticTextProperties: {
          textContent: '',
          fontFamily: { label: 'Roboto', value: 'roboto' },
          fontSize: { label: '16', value: 16 },
          fontWeight: { label: 'Regular', value: 'regular' },
          letterSpacing: { label: '1', value: 1 },
          lineHeight: { label: '1', value: 1 },
          textColor: '#000000',
          textAlign: 'left',
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
    editArtworkx: (state, action) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork[property] = value
      }
    },
    deleteArtwork: (state, action) => {
      const { artworkId } = action.payload
      state.artworks = state.artworks.filter((artwork) => artwork.id !== artworkId)
    },
    editAlignArtwork: (state, action) => {
      const { currentArtworkId, artworkPosition } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.canvas.x = artworkPosition.x
        artwork.canvas.y = artworkPosition.y
      }
    },
    edit3DCoordinates: (state, action) => {
      const { currentArtworkId, serialized3DCoordinate } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.space = serialized3DCoordinate
      }
    },
    editArtisticImage: (state, action) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        if (!artwork.artisticImageProperties) {
          artwork.artisticImageProperties = {}
        }
        artwork.artisticImageProperties[property] = value
      }
    },
    editArtisticText: (state, action) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        if (!artwork.artisticTextProperties) {
          artwork.artisticTextProperties = {}
        }
        artwork.artisticTextProperties[property] = value
      }
    },
  },
})

export const {
  createArtwork,
  editArtwork,
  editArtworkx,
  editAlignArtwork,
  edit3DCoordinates,
  deleteArtwork,
  editArtisticImage,
  editArtisticText,
} = artworksSlice.actions
export default artworksSlice.reducer
