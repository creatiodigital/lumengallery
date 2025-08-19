import { configureStore } from '@reduxjs/toolkit'

import artistReducer from './slices/artistSlice'
import artworksReducer from './slices/artworksSlice'
import dashboardReducer from './slices/dashboardSlice'
import exhibitionReducer from './slices/exhibitionSlice'
import sceneReducer from './slices/sceneSlice'
import wallViewReducer from './slices/wallViewSlice'
import wizardReducer from './slices/wizardSlice'

export const makeStore = () => {
  return configureStore({
    reducer: {
      dashboard: dashboardReducer,
      exhibition: exhibitionReducer,
      wizard: wizardReducer,
      wallView: wallViewReducer,
      artist: artistReducer,
      artworks: artworksReducer,
      scene: sceneReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore non-serializable values in specific actions or paths
          ignoredActions: ['artworks/editArtworkTextureImage'],
          ignoredPaths: ['artworks.artworks.texture'], // Adjust based on your state shape
        },
      }),
  })
}
