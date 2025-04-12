import { createSlice } from '@reduxjs/toolkit'
import { createNewArtwork } from './mocks'

const artworksSlice = createSlice({
  name: 'artworks',
  initialState: {
    byId: {},
    allIds: [],
    artworkCounters: {
      paint: 0,
      text: 0,
    },
  },
  reducers: {
    createArtwork: (state, action) => {
      const { wallId, id, canvas, artworkType } = action.payload

      if (artworkType in state.artworkCounters) {
        state.artworkCounters[artworkType] += 1
      } else {
        state.artworkCounters[artworkType] = 1
      }

      const newArtwork = createNewArtwork({ id, wallId, canvas, artworkType })

      newArtwork.name = `${artworkType.charAt(0).toUpperCase() + artworkType.slice(1)} ${state.artworkCounters[artworkType]}`

      state.byId[id] = newArtwork
      state.allIds.push(id)
    },

    editArtwork: (state, action) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]
      if (artwork) {
        artwork[property] = value
      }
    },

    editArtworkCanvas: (state, action) => {
      const { currentArtworkId, canvasUpdates } = action.payload
      const artwork = state.byId[currentArtworkId]
      if (artwork) {
        artwork.canvas = {
          ...artwork.canvas,
          ...canvasUpdates,
        }
      }
    },

    editArtworkSpace: (state, action) => {
      const { currentArtworkId, spaceUpdates } = action.payload
      const artwork = state.byId[currentArtworkId]
      if (artwork) {
        artwork.space = {
          ...artwork.space,
          ...spaceUpdates,
        }
      }
    },

    editArtisticImage: (state, action) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]
      if (artwork) {
        if (!artwork.artisticImageProperties) {
          artwork.artisticImageProperties = {}
        }
        artwork.artisticImageProperties[property] = value
      }
    },

    editArtisticText: (state, action) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]
      if (artwork) {
        if (!artwork.artisticTextProperties) {
          artwork.artisticTextProperties = {}
        }
        artwork.artisticTextProperties[property] = value
      }
    },

    deleteArtwork: (state, action) => {
      const { artworkId } = action.payload
      delete state.byId[artworkId]
      state.allIds = state.allIds.filter((id) => id !== artworkId)
    },
  },
})

export const {
  createArtwork,
  editArtwork,
  editArtworkCanvas,
  editArtworkSpace,
  editArtisticImage,
  editArtisticText,
  deleteArtwork,
} = artworksSlice.actions
export default artworksSlice.reducer
