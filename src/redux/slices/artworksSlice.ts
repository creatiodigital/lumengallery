import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { createNewArtwork } from '@/factories/artworkFactory'
import type { ArtworkType, ArtworkKind, ArtisticImageType, ArtisticTextType } from '@/types/artwork'

interface ArtworksState {
  byId: Record<string, ArtworkType>
  allIds: string[]
  artworkCounters: Record<string, number>
}

const initialState: ArtworksState = {
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
      action: PayloadAction<{ wallId: string; id: string; artworkType: ArtworkKind }>,
    ) => {
      const { wallId, id, artworkType } = action.payload

      state.artworkCounters[artworkType] = (state.artworkCounters[artworkType] ?? 0) + 1

      const newArtwork = createNewArtwork({ id, wallId, canvas: '', artworkType })

      newArtwork.name = `${artworkType.charAt(0).toUpperCase() + artworkType.slice(1)} ${
        state.artworkCounters[artworkType]
      }`

      state.byId[id] = newArtwork
      state.allIds.push(id)
    },

    editArtwork: <K extends keyof ArtworkType>(
      state: ArtworksState,
      action: PayloadAction<{ currentArtworkId: string; property: K; value: ArtworkType[K] }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]
      if (artwork) {
        artwork[property] = value
      }
    },

    editArtisticImage: <K extends keyof ArtisticImageType>(
      state: ArtworksState,
      action: PayloadAction<{ currentArtworkId: string; property: K; value: ArtisticImageType[K] }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]
      if (artwork) {
        artwork.artisticImageProperties ??= {} as ArtisticImageType
        artwork.artisticImageProperties[property] = value
      }
    },

    editArtisticText: <K extends keyof ArtisticTextType>(
      state: ArtworksState,
      action: PayloadAction<{ currentArtworkId: string; property: K; value: ArtisticTextType[K] }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]
      if (artwork) {
        artwork.artisticTextProperties ??= {} as ArtisticTextType
        artwork.artisticTextProperties[property] = value
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
