import { createSlice } from '@reduxjs/toolkit'

const artistSlice = createSlice({
  name: 'artist',
  initialState: {
    id: '123456',
    name: 'Eduardo',
    lastName: 'Plaza',
    handler: 'eduardo-plaza',
    artworks: [],
    artworkCounters: {
      paint: 0,
      text: 0,
    },
    walls: [],
  },
  reducers: {
    setHandler: (state, action) => {
      state.handler = action.payload
    },
    showEditMode: (state) => {
      state.isEditMode = true
    },
    hideEditMode: (state) => {
      state.isEditMode = false
    },
    addWall: (state, action) => {
      const wallId = action.payload
      const wallIndex = state.walls.length + 1
      const readableName = `Wall ${wallIndex}`
      state.walls.push({ id: wallId.id, name: readableName })
    },
    editWallName: (state, action) => {
      const { wallId, newName } = action.payload
      const wall = state.walls.find((wall) => wall.id === wallId)
      if (wall) {
        wall.name = newName
      }
    },
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
        artisticTextStyles: {
          fontFamily: 'Roboto',
          fontSize: 16,
          lineHeight: { label: '1', value: 1 },
          color: '#000000',
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
    editArtworkTextFontSize: (state, action) => {
      const { currentArtworkId, fontSize } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        if (!artwork.artisticTextStyles) {
          artwork.artisticTextStyles = {}
        }
        artwork.artisticTextStyles.fontSize = fontSize
      }
    },
    editArtworkTextLineHeight: (state, action) => {
      const { currentArtworkId, lineHeight } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        if (!artwork.artisticTextStyles) {
          artwork.artisticTextStyles = {}
        }
        artwork.artisticTextStyles.lineHeight = lineHeight
      }
    },
    editArtworkTextFontWeight: (state, action) => {
      const { currentArtworkId, fontWeight } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        if (!artwork.artisticTextStyles) {
          artwork.artisticTextStyles = {}
        }
        artwork.artisticTextStyles.fontWeight = fontWeight
      }
    },
    editArtworkTextLetterSpacing: (state, action) => {
      const { currentArtworkId, letterSpacing } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        if (!artwork.artisticTextStyles) {
          artwork.artisticTextStyles = {}
        }
        artwork.artisticTextStyles.letterSpacing = letterSpacing
      }
    },
    editArtworkTextFontFamily: (state, action) => {
      const { currentArtworkId, fontFamily } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        if (!artwork.artisticTextStyles) {
          artwork.artisticTextStyles = {}
        }
        artwork.artisticTextStyles.fontFamily = fontFamily
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
    editArtworkFrameColor: (state, action) => {
      const { currentArtworkId, frameColor } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.frameStyles.frameColor = frameColor
      }
    },
    editArtworkPassepartoutColor: (state, action) => {
      const { currentArtworkId, passepartoutColor } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.passepartoutStyles.passepartoutColor = passepartoutColor
      }
    },
    editArtworkFrameThickness: (state, action) => {
      const { currentArtworkId, frameThickness } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (artwork) {
        artwork.frameStyles.frameThickness = frameThickness
      }
    },
    editArtworkPassepartoutThickness: (state, action) => {
      const { currentArtworkId, passepartoutThickness } = action.payload
      const artwork = state.artworks.find((artwork) => artwork.id === currentArtworkId)
      if (passepartoutThickness) {
        artwork.passepartoutStyles.passepartoutThickness = passepartoutThickness
      }
    },
  },
})

export const {
  showEditMode,
  hideEditMode,
  setHandler,
  addWall,
  editWallName,
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
  editArtworkTextFontSize,
  editArtworkTextLineHeight,
  editArtworkTextFontWeight,
  editArtworkTextLetterSpacing,
  editArtworkTextFontFamily,
  showArtworkFrame,
  showArtworkPassepartout,
  showArtworkInformation,
  editArtworkFrameColor,
  editArtworkPassepartoutColor,
  editArtworkFrameThickness,
  editArtworkPassepartoutThickness,
} = artistSlice.actions
export default artistSlice.reducer
