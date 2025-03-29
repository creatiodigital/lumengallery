import { configureStore } from '@reduxjs/toolkit'

import artistReducer from './features/artistSlice'
import artworksReducer from './features/artworksSlice'
import dashboardReducer from './features/dashboardSlice'
import sceneReducer from './features/sceneSlice'
import wallViewReducer from './features/wallViewSlice'
import wizardReducer from './features/wizardSlice'

export const makeStore = () => {
  return configureStore({
    reducer: {
      dashboard: dashboardReducer,
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
