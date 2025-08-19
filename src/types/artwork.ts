// types/artwork.ts
export type ArtworkKind = 'image' | 'text' // extend later: | 'video'

export type FontFamily = 'roboto' | 'lora'
export type FontWeight = 'regular' | 'bold'
export type TextAlign = 'left' | 'right' | 'center'

export interface ArtisticImageType {
  imageUrl: string
  showArtworkInformation: boolean
  showFrame: boolean
  frameColor: string
  frameThickness: { label: string; value: number }
  showPassepartout: boolean
  passepartoutColor: string
  passepartoutThickness: { label: string; value: number }
}

export interface ArtisticTextType {
  textContent: string
  fontFamily: { label: string; value: FontFamily }
  fontSize: { label: string; value: number }
  fontWeight: { label: string; value: FontWeight }
  letterSpacing: { label: string; value: number }
  lineHeight: { label: string; value: number }
  textColor: string
  textAlign: TextAlign
}

export interface ArtworkType {
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
