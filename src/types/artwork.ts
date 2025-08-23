export type FontFamily = 'roboto' | 'lora'
export type FontWeight = 'regular' | 'bold'
export type TextAlign = 'left' | 'right' | 'center'

export type Option<T> = { label: string; value: T }

export type ArtworkKindType = 'image' | 'text'

export type ArtworkPositionType = {
  posX3d: number
  posY3d: number
  posZ3d: number
  rotation?: number
  scale?: number
  quaternionX: number
  quaternionY: number
  quaternionZ: number
  quaternionW: number
  width3d?: number
  height3d?: number
}

export type ArtworkType = {
  id: string
  name: string
  wallId: string
  dimensions: string
  position: { x: number; y: number; z: number }
  rotation?: number
  scale?: number
  quaternion?: { x: number; y: number; z: number; w: number }
  width?: number
  height?: number
}

export type ArtisticImageType = ArtworkType & {
  artworkType: 'image'
  artisticImageProperties: {
    imageUrl: string
    showArtworkInformation: boolean
    showFrame: boolean
    frameColor: string
    frameThickness: Option<number>
    showPassepartout: boolean
    passepartoutColor: string
    passepartoutThickness: Option<number>
  }
}

export type ArtisticTextType = ArtworkType & {
  artworkType: 'text'
  artisticTextProperties: {
    textContent: string
    fontFamily: Option<'roboto' | 'lora'>
    fontSize: Option<number>
    fontWeight: Option<'regular' | 'bold'>
    letterSpacing: Option<number>
    lineHeight: Option<number>
    textColor: string
    textAlign: 'left' | 'right' | 'center'
  }
}

export type Artwork = ArtisticImageType | ArtisticTextType
