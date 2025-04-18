import { useSelector } from 'react-redux'

export const useArtworkDetails = (currentArtworkId) => {
  const artworksById = useSelector((state) => state.artworks.byId)
  const positionsById = useSelector((state) => state.exhibition.positionsById)

  const artwork = artworksById[currentArtworkId]
  const artworkPosition = positionsById[currentArtworkId]

  if (!artwork || !artworkPosition) {
    return {
      name: '',
      artworkTitle: '',
      author: '',
      artworkYear: '',
      artworkDimensions: '',
      description: '',
      textContent: '',
      artisticTextProperties: {},
      artisticImageProperties: {},
      artworkType: '',
      width: 0,
      height: 0,
      x: 0,
      y: 0,
    }
  }

  const { width2d, height3d, posX2d, posY2d } = artworkPosition
  const {
    name,
    artworkTitle,
    author,
    artworkYear,
    artworkDimensions,
    description,
    textContent,
    artworkType,
    artisticTextProperties,
    artisticImageProperties,
  } = artwork

  return {
    width: Math.round(width2d),
    height: Math.round(height3d),
    x: Math.round(posX2d),
    y: Math.round(posY2d),
    name,
    artworkTitle,
    author,
    artworkYear,
    artworkDimensions,
    description,
    textContent,
    artisticTextProperties,
    artisticImageProperties,
    artworkType,
  }
}
