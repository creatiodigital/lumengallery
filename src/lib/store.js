import { configureStore } from '@reduxjs/toolkit'

import artistReducer from './features/artistSlice'
import dashboardReducer from './features/dashboardSlice'
import wallViewReducer from './features/wallViewSlice'
import wizardReducer from './features/wizardSlice'

export const makeStore = () => {
  return configureStore({
    reducer: {
      dashboard: dashboardReducer,
      wizard: wizardReducer,
      wallView: wallViewReducer,
      artist: artistReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore non-serializable values in specific actions or paths
          ignoredActions: ['artist/editArtworkTextureImage'],
          ignoredPaths: ['artist.artworks.texture'], // Adjust based on your state shape
        },
      }),
  })
}
