export type ArtworkKind = 'image' | 'text'

export type FontFamily = 'roboto' | 'lora'
export type FontWeight = 'regular' | 'bold'
export type TextAlign = 'left' | 'right' | 'center'

export type Option<T> = { label: string; value: T }

export type ArtisticImageType = {
  imageUrl: string
  showArtworkInformation: boolean
  showFrame: boolean
  frameColor: string
  frameThickness: Option<number>
  showPassepartout: boolean
  passepartoutColor: string
  passepartoutThickness: Option<number>
}

export type ArtisticTextType = {
  textContent: string
  fontFamily: Option<FontFamily>
  fontSize: Option<number>
  fontWeight: Option<FontWeight>
  letterSpacing: Option<number>
  lineHeight: Option<number>
  textColor: string
  textAlign: TextAlign
}

export type ArtworkType = {
  id: string
  name: string
  artworkType: ArtworkKind
  wallId: string
  canvas: string
  space: string[]
  author: string
  title: string
  year: string
  description: string
  dimensions: string
  artisticImageProperties?: ArtisticImageType
  artisticTextProperties?: ArtisticTextType
}

export type ArtworkPosition = {
  x: number
  y: number
  z: number
  rotation?: number
  scale?: number
}
