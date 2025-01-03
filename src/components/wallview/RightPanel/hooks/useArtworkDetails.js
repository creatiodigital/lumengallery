import { useSelector } from 'react-redux'

export const useArtworkDetails = (currentArtworkId) => {
  const artwork = useSelector((state) =>
    state.artist.artworks.find((art) => art.id === currentArtworkId),
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
      artisticTextStyles: {},
      artworkType: '',
      showFrame: false,
      showArtworkInformation: false,
      frameStyles: {},
    }

  const { width, height, x, y } = artwork.canvas
  const {
    name,
    artworkTitle,
    author,
    artworkYear,
    artworkDimensions,
    description,
    artisticText,
    artworkType,
    showFrame,
    showArtworkInformation,
    frameStyles,
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
    artworkYear,
    artworkDimensions,
    description,
    artisticText,
    artisticTextStyles,
    artworkType,
    showFrame,
    showArtworkInformation,
    frameStyles,
  }
}
