export type TFontFamily = 'roboto' | 'lora'
export type TFontWeight = 'regular' | 'bold'
export type TTextAlign = 'left' | 'right' | 'center'

export type TOption<T> = { label: string; value: T }

export type TArtworkKind = 'image' | 'text'

export type TArtworkPosition = {
  id?: string
  wallId?: string
  posX2d: number
  posY2d: number
  posX3d: number
  posY3d: number
  posZ3d: number
  rotation?: number
  scale?: number
  quaternionX: number
  quaternionY: number
  quaternionZ: number
  quaternionW: number
  width2d: number
  height2d: number
  width3d?: number
  height3d?: number
  imageURL?: string
}

export type TArtworkBase = {
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

export type TArtisticImage = TArtworkBase & {
  artworkType: 'image'
  artisticImageProperties: {
    imageUrl: string
    showArtworkInformation: boolean
    showFrame: boolean
    frameColor: string
    frameThickness: TOption<number>
    showPassepartout: boolean
    passepartoutColor: string
    passepartoutThickness: TOption<number>
  }
}

export type TArtisticText = TArtworkBase & {
  artworkType: 'text'
  artisticTextProperties: {
    textContent: string
    fontFamily: TOption<'roboto' | 'lora'>
    fontSize: TOption<number>
    fontWeight: TOption<'regular' | 'bold'>
    letterSpacing: TOption<number>
    lineHeight: TOption<number>
    textColor: string
    textAlign: 'left' | 'right' | 'center'
  }
}

export type TArtwork = TArtisticImage | TArtisticText
