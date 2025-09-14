import type { TArtwork, TArtworkKind } from '@/types/artwork'

export const createNewArtwork = ({
  id,
  artworkType,
}: {
  id: string
  artworkType: TArtworkKind
}): TArtwork => {
  return {
    id,
    name: '',
    artworkType,
    artworkTitle: '',
    author: '',
    artworkDimensions: '',
    artworkYear: '',
    description: '',
    imageUrl: '',
    showArtworkInformation: false,
    showFrame: false,
    frameColor: '#000000',
    frameThickness: { label: '1', value: 1 },
    showPassepartout: false,
    passepartoutColor: '#ffffff',
    passepartoutThickness: { label: '0', value: 0 },
    textContent: '',
    fontFamily: { label: 'Roboto', value: 'roboto' },
    fontSize: { label: '16', value: 16 },
    fontWeight: { label: 'Regular', value: 'regular' },
    letterSpacing: { label: '1', value: 1 },
    lineHeight: { label: '1', value: 1 },
    textColor: '#000000',
    textAlign: 'left',
  }
}
