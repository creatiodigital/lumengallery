// factories/createNewArtwork.ts
import { ArtworkType, ArtworkKind } from '@/types/artwork'

export const createNewArtwork = ({
  id,
  wallId,
  canvas,
  artworkType,
}: {
  id: string
  wallId: string
  canvas: string
  artworkType: ArtworkKind
}): ArtworkType => {
  return {
    id,
    name: '',
    artworkType,
    wallId,
    canvas,
    space: [],
    author: '',
    title: '',
    year: '',
    description: '',
    dimensions: '',
    artisticImageProperties: {
      imageUrl: '',
      showArtworkInformation: false,
      showFrame: false,
      frameColor: '#000000',
      frameThickness: { label: '1', value: 1 },
      showPassepartout: false,
      passepartoutColor: '#ffffff',
      passepartoutThickness: { label: '0', value: 0 },
    },
    artisticTextProperties: {
      textContent: '',
      fontFamily: { label: 'Roboto', value: 'roboto' },
      fontSize: { label: '16', value: 16 },
      fontWeight: { label: 'Regular', value: 'regular' },
      letterSpacing: { label: '1', value: 1 },
      lineHeight: { label: '1', value: 1 },
      textColor: '#000000',
      textAlign: 'left',
    },
  }
}
