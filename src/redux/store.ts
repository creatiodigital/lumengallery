import { configureStore } from '@reduxjs/toolkit'

import artworksReducer from './slices/artworksSlice'
import dashboardReducer from './slices/dashboardSlice'
import exhibitionReducer from './slices/exhibitionSlice'
import sceneReducer from './slices/sceneSlice'
import userReducer from './slices/userSlice'
import wallViewReducer from './slices/wallViewSlice'
import wizardReducer from './slices/wizardSlice'

export const makeStore = () => {
  return configureStore({
    reducer: {
      dashboard: dashboardReducer,
      exhibition: exhibitionReducer,
      wizard: wizardReducer,
      wallView: wallViewReducer,
      user: userReducer,
      artworks: artworksReducer,
      scene: sceneReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['artworks/editArtworkTextureImage'],
          ignoredPaths: ['artworks.artworks.texture'],
        },
      }),
  })
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
