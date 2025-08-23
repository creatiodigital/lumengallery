import type { Artwork, ArtworkKindType } from '@/types/artwork'

export const createNewArtwork = ({
  id,
  wallId,
  artworkType,
}: {
  id: string
  wallId: string
  artworkType: ArtworkKindType
}): Artwork => {
  const base = {
    id,
    name: '',
    wallId,
    dimensions: '',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    scale: 1,
  }

  if (artworkType === 'image') {
    return {
      ...base,
      artworkType: 'image',
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
    }
  }

  if (artworkType === 'text') {
    return {
      ...base,
      artworkType: 'text',
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

  // If you add future kinds (video, 3D object, etc.)
  throw new Error(`Unsupported artwork type: ${artworkType}`)
}
