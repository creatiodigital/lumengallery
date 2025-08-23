import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { createNewArtwork } from '@/factories/artworkFactory'
import type { TArtwork, TArtworkKind, TArtisticImage, TArtisticText } from '@/types/artwork'

interface ArtworksState {
  byId: Record<string, TArtwork>
  allIds: string[]
  artworkCounters: Record<TArtworkKind, number>
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
      action: PayloadAction<{ wallId: string; id: string; artworkType: TArtworkKind }>,
    ) => {
      const { wallId, id, artworkType } = action.payload

      state.artworkCounters[artworkType] = (state.artworkCounters[artworkType] ?? 0) + 1

      console.log('xxx', artworkType)

      const newArtwork = createNewArtwork({ id, wallId, artworkType })

      newArtwork.name = `${artworkType.charAt(0).toUpperCase() + artworkType.slice(1)} ${
        state.artworkCounters[artworkType]
      }`

      state.byId[id] = newArtwork
      state.allIds.push(id)
    },

    editArtwork: <
      K extends Exclude<keyof TArtwork, 'artisticImageProperties' | 'artisticTextProperties'>,
    >(
      state: ArtworksState,
      action: PayloadAction<{ currentArtworkId: string; property: K; value: TArtwork[K] }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]
      if (artwork) {
        artwork[property] = value
      }
    },

    editArtisticImage: <K extends keyof TArtisticImage['artisticImageProperties']>(
      state: ArtworksState,
      action: PayloadAction<{
        currentArtworkId: string
        property: K
        value: TArtisticImage['artisticImageProperties'][K]
      }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]

      if (artwork?.artworkType === 'image') {
        const imageArtwork = artwork as TArtisticImage
        imageArtwork.artisticImageProperties[property] = value
      }
    },

    editArtisticText: <K extends keyof TArtisticText['artisticTextProperties']>(
      state: ArtworksState,
      action: PayloadAction<{
        currentArtworkId: string
        property: K
        value: TArtisticText['artisticTextProperties'][K]
      }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]

      if (artwork?.artworkType === 'text') {
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
