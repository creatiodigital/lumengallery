import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'
import type { TOption } from '@/types/artwork'
import type { TFontFamily, TFontWeight } from '@/types/fonts'

export const useArtworkDetails = (currentArtworkId: string) => {
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  const artwork = artworksById[currentArtworkId]
  const artworkPosition = exhibitionArtworksById[currentArtworkId]

  if (!artwork || !artworkPosition) {
    return {
      name: '',
      artworkTitle: '',
      author: '',
      artworkYear: '',
      artworkDimensions: '',
      description: '',
      textContent: '',
      artworkType: '',
      showArtworkInformation: false,
      showFrame: false,
      frameColor: '#000000',
      textColor: '#000000',
      fontSize: { label: '16', value: 16 } as TOption<number>,
      lineHeight: { label: '20', value: 20 } as TOption<number>,
      fontWeight: { label: 'Regular', value: 'regular' } as TOption<TFontWeight>,
      letterSpacing: { label: '0', value: 0 } as TOption<number>,
      fontFamily: { label: 'Roboto', value: 'roboto' } as TOption<TFontFamily>,
      frameThickness: { label: '1', value: 1 },
      showPassepartout: false,
      passepartoutColor: '#ffffff',
      passepartoutThickness: { label: '0', value: 0 },
      imageUrl: '',
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
    showArtworkInformation,
    showFrame,
    frameColor,
    textColor,
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    fontFamily,
    frameThickness,
    showPassepartout,
    passepartoutColor,
    passepartoutThickness,
    imageUrl,
  } = artwork

  return {
    width: Math.round(width2d),
    height: Math.round(height3d!),
    x: Math.round(posX2d),
    y: Math.round(posY2d),
    name,
    artworkTitle,
    author,
    artworkYear,
    artworkDimensions,
    description,
    textContent,
    artworkType,
    showArtworkInformation,
    showFrame,
    frameColor,
    textColor,
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    fontFamily,
    frameThickness,
    showPassepartout,
    passepartoutColor,
    passepartoutThickness,
    imageUrl,
  }
}
