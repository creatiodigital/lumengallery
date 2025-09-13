import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { createNewArtwork } from '@/factories/artworkFactory'
import type { TArtwork, TArtworkKind } from '@/types/artwork'

interface TArtworksState {
  byId: Record<string, TArtwork>
  allIds: string[]
  artworkCounters: Record<TArtworkKind, number>
}

const initialState: TArtworksState = {
  byId: {},
  allIds: [],
  artworkCounters: {
    image: 0,
    text: 0,
  },
}

const artworksSlice = createSlice({
  name: 'artworks',
  initialState,
  reducers: {
    createArtwork: (
      state,
      action: PayloadAction<{ wallId: string; id: string; artworkType: TArtworkKind }>,
    ) => {
      const { wallId, id, artworkType } = action.payload

      state.artworkCounters[artworkType] = (state.artworkCounters[artworkType] ?? 0) + 1

      const newArtwork = createNewArtwork({ id, wallId, artworkType })

      newArtwork.name = `${artworkType.charAt(0).toUpperCase() + artworkType.slice(1)} ${
        state.artworkCounters[artworkType]
      }`

      state.byId[id] = newArtwork
      state.allIds.push(id)
    },

    editArtwork: <K extends keyof TArtwork>(
      state: TArtworksState,
      action: PayloadAction<{ currentArtworkId: string; property: K; value: TArtwork[K] }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]
      if (artwork) {
        artwork[property] = value
      }
    },

    editArtisticImage: <K extends keyof TArtwork>(
      state: TArtworksState,
      action: PayloadAction<{ currentArtworkId: string; property: K; value: TArtwork[K] }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]

      if (artwork?.artworkType === 'image') {
        artwork[property] = value
      }
    },

    editArtisticText: <K extends keyof TArtwork>(
      state: TArtworksState,
      action: PayloadAction<{ currentArtworkId: string; property: K; value: TArtwork[K] }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]

      if (artwork?.artworkType === 'text') {
        artwork[property] = value
      }
    },

    deleteArtwork: (state, action: PayloadAction<{ artworkId: string }>) => {
      const { artworkId } = action.payload
      delete state.byId[artworkId]
      state.allIds = state.allIds.filter((id) => id !== artworkId)
    },
  },
})

export const { createArtwork, editArtwork, editArtisticImage, editArtisticText, deleteArtwork } =
  artworksSlice.actions

export default artworksSlice.reducer
