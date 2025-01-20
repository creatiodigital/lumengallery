import { useSelector } from 'react-redux'

export const useArtworkDetails = (currentArtworkId) => {
  const artwork = useSelector((state) =>
    state?.artist?.artworks?.find((art) => art.id === currentArtworkId),
  )

  if (!artwork)
    return {
      width: '',
      height: '',
      x: '',
      y: '',
      name: '',
      artworkTitle: '',
      author: '',
      artworkYear: '',
      artworkDimensions: '',
      description: '',
      artisticText: '',
      url: '',
      artisticTextStyles: {},
      artworkType: '',
      showFrame: false,
      showPassepartout: false,
      showArtworkInformation: false,
      frameStyles: {},
      passepartoutStyles: {},
    }

  const { width, height, x, y } = artwork.canvas
  const {
    name,
    artworkTitle,
    author,
    url,
    artworkYear,
    artworkDimensions,
    description,
    artisticText,
    artworkType,
    showFrame,
    showArtworkInformation,
    frameStyles,
    showPassepartout,
    passepartoutStyles,
    artisticTextStyles,
  } = artwork

  return {
    width: Math.round(width),
    height: Math.round(height),
    x: Math.round(x),
    y: Math.round(y),
    name,
    artworkTitle,
    author,
    url,
    artworkYear,
    artworkDimensions,
    description,
    artisticText,
    artisticTextStyles,
    artworkType,
    showFrame,
    showArtworkInformation,
    frameStyles,
    showPassepartout,
    passepartoutStyles,
  }
}
