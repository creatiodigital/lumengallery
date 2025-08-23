export type FontFamilyType = 'roboto' | 'lora'
export type FontWeightType = 'regular' | 'bold'
export type TextAlignType = 'left' | 'right' | 'center'

export type OptionType<T> = { label: string; value: T }

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
    frameThickness: OptionType<number>
    showPassepartout: boolean
    passepartoutColor: string
    passepartoutThickness: OptionType<number>
  }
}

export type ArtisticTextType = ArtworkType & {
  artworkType: 'text'
  artisticTextProperties: {
    textContent: string
    fontFamily: OptionType<'roboto' | 'lora'>
    fontSize: OptionType<number>
    fontWeight: OptionType<'regular' | 'bold'>
    letterSpacing: OptionType<number>
    lineHeight: OptionType<number>
    textColor: string
    textAlign: 'left' | 'right' | 'center'
  }
}

export type Artwork = ArtisticImageType | ArtisticTextType
