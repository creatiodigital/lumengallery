export type TFontFamily = 'roboto' | 'lora'
export type TFontWeight = 'regular' | 'bold'
export type TTextAlign = 'left' | 'right' | 'center'
export type TArtworkKind = 'image' | 'text'

export type TOption<T> = { label: string; value: T }

export type TArtworkPosition = {
  id?: string
  artworkId: string // reference to TArtwork.id
  exhibitionId?: string
  wallId: string

  // 2D placement
  posX2d: number
  posY2d: number
  width2d: number
  height2d: number

  // 3D placement
  posX3d: number
  posY3d: number
  posZ3d: number
  width3d?: number
  height3d?: number
  rotation?: number
  quaternionX: number
  quaternionY: number
  quaternionZ: number
  quaternionW: number
}

export type TArtwork = {
  id: string
  name: string
  artworkType?: TArtworkKind
  artworkTitle?: string
  author?: string
  artworkDimensions?: string
  artworkYear?: string
  description?: string
  imageUrl?: string
  showArtworkInformation?: boolean
  showFrame?: boolean
  frameColor?: string
  frameThickness?: TOption<number>
  showPassepartout?: boolean
  passepartoutColor?: string
  passepartoutThickness?: TOption<number>
  textContent?: string
  fontFamily?: TOption<'roboto' | 'lora'>
  fontSize?: TOption<number>
  fontWeight?: TOption<'regular' | 'bold'>
  letterSpacing?: TOption<number>
  lineHeight?: TOption<number>
  textColor?: string
  textAlign?: 'left' | 'right' | 'center'
}
