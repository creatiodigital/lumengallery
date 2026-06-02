import type { AppDispatch } from '@/redux/store'
import { editArtwork, editArtisticImage, editArtisticText } from '@/redux/slices/artworkSlice'
import { updateArtworkPosition } from '@/redux/slices/exhibitionSlice'
import { convert2DTo3D } from '@/components/wallview/utils'
import type { TArtwork, TArtworkPosition } from '@/types/artwork'
import type { TDimensions } from '@/types/geometry'

type PresetType = 'image' | 'text' | 'shape'

type TPreset = {
  id: string
  name: string
  presetType: string
  width2d: number
  height2d: number
  showFrame: boolean
  frameColor: string
  frameSize: number
  frameThickness: number
  frameMaterial: string
  frameCornerStyle: string
  frameTextureScale: number
  frameTextureRotation: number
  frameTextureRoughness: number
  frameTextureNormalScale: number
  showPassepartout: boolean
  passepartoutColor: string
  passepartoutSize: number
  passepartoutThickness: number
  showPaperBorder: boolean
  paperBorderSize: number
  showSupport: boolean
  supportThickness: number
  supportColor: string
  hideShadow: boolean
  fontFamily: string
  fontSize: number
  fontWeight: string
  letterSpacing: number
  lineHeight: number
  textColor: string
  textBackgroundColor: string | null
  textBackgroundTexture: string | null
  showTextBorder: boolean
  textBorderColor: string
  textBorderOffset: number
  showMonogram: boolean
  monogramColor: string
  monogramOpacity: number
  monogramPosition: string
  monogramOffset: number
  monogramSize: number
  textAlign: string
  textVerticalAlign: string
  textPadding: number
  textPaddingTop: number
  textPaddingBottom: number
  textPaddingLeft: number
  textPaddingRight: number
  textThickness: number
  // Shape properties
  shapeType: string
  shapeColor: string
  shapeOpacity: number
}

export type { TPreset, PresetType }

/**
 * Apply a preset to a single artwork, dispatching all necessary Redux actions.
 * Shared between single-artwork apply (PresetSection) and batch apply (GroupPresetApply).
 */
export function applyPresetToArtwork(
  dispatch: AppDispatch,
  preset: TPreset,
  artworkId: string,
  presetType: PresetType,
  exhibitionArtworksById: Record<string, TArtworkPosition>,
  boundingData: TDimensions | null,
): void {
  // Skip locked artworks
  const exhibitionArtwork = exhibitionArtworksById[artworkId]
  if (!exhibitionArtwork) return
  if ((exhibitionArtwork as TArtworkPosition & { locked?: boolean }).locked) return

  // Apply dimensions via exhibitionSlice, recomputing full 3D transform
  const currentPos = exhibitionArtworksById[artworkId]
  if (currentPos && boundingData) {
    const new3D = convert2DTo3D(
      currentPos.posX2d,
      currentPos.posY2d,
      preset.width2d,
      preset.height2d,
      boundingData,
    )
    dispatch(
      updateArtworkPosition({
        artworkId,
        artworkPosition: {
          width2d: preset.width2d,
          height2d: preset.height2d,
          ...new3D,
        },
      }),
    )
  } else {
    // Fallback: just update 2D dims
    dispatch(
      updateArtworkPosition({
        artworkId,
        artworkPosition: {
          width2d: preset.width2d,
          height2d: preset.height2d,
        },
      }),
    )
  }

  // Apply display properties via artworkSlice
  const editAction =
    presetType === 'text'
      ? editArtisticText
      : presetType === 'shape'
        ? editArtwork
        : editArtisticImage
  const applyProp = <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => {
    dispatch(editAction({ currentArtworkId: artworkId, property, value }))
  }

  // Frame
  applyProp('showFrame', preset.showFrame)
  applyProp('frameColor', preset.frameColor)
  applyProp('frameSize', { label: String(preset.frameSize), value: preset.frameSize })
  applyProp('frameThickness', {
    label: String(preset.frameThickness),
    value: preset.frameThickness,
  })
  applyProp('frameMaterial', preset.frameMaterial ?? 'plastic')
  applyProp('frameCornerStyle', preset.frameCornerStyle ?? 'mitered')
  applyProp('frameTextureScale', preset.frameTextureScale ?? 2.0)
  applyProp('frameTextureRotation', preset.frameTextureRotation ?? 0)
  applyProp('frameTextureRoughness', preset.frameTextureRoughness ?? 0.6)
  applyProp('frameTextureNormalScale', preset.frameTextureNormalScale ?? 0.5)

  // Passepartout
  applyProp('showPassepartout', preset.showPassepartout)
  applyProp('passepartoutColor', preset.passepartoutColor)
  applyProp('passepartoutSize', {
    label: String(preset.passepartoutSize),
    value: preset.passepartoutSize,
  })
  applyProp('passepartoutThickness', {
    label: String(preset.passepartoutThickness),
    value: preset.passepartoutThickness,
  })

  // Border (white paper margin around image)
  applyProp('showPaperBorder', preset.showPaperBorder)
  applyProp('paperBorderSize', {
    label: String(preset.paperBorderSize),
    value: preset.paperBorderSize,
  })

  // Support
  applyProp('showSupport', preset.showSupport)
  applyProp('supportThickness', {
    label: String(preset.supportThickness),
    value: preset.supportThickness,
  })
  applyProp('supportColor', preset.supportColor)

  // Shadow
  applyProp('hideShadow', preset.hideShadow)

  // Text properties (for text presets)
  if (presetType === 'text') {
    applyProp('fontFamily', {
      label: preset.fontFamily,
      value: preset.fontFamily as TArtwork['fontFamily'] extends { value: infer V } ? V : never,
    } as TArtwork['fontFamily'])
    applyProp('fontSize', { label: String(preset.fontSize), value: preset.fontSize })
    applyProp('fontWeight', {
      label: preset.fontWeight,
      value: preset.fontWeight as TArtwork['fontWeight'] extends { value: infer V } ? V : never,
    } as TArtwork['fontWeight'])
    applyProp('letterSpacing', {
      label: String(preset.letterSpacing),
      value: preset.letterSpacing,
    })
    applyProp('lineHeight', { label: String(preset.lineHeight), value: preset.lineHeight })
    applyProp('textColor', preset.textColor)
    applyProp('textBackgroundColor', preset.textBackgroundColor ?? undefined)
    applyProp('textBackgroundTexture', preset.textBackgroundTexture ?? undefined)
    applyProp('showTextBorder', preset.showTextBorder ?? false)
    applyProp('textBorderColor', preset.textBorderColor ?? '#c9a96e')
    applyProp('textBorderOffset', {
      label: String(preset.textBorderOffset ?? 1.2),
      value: preset.textBorderOffset ?? 1.2,
    })
    applyProp('showMonogram', preset.showMonogram ?? false)
    applyProp('monogramColor', preset.monogramColor ?? '#c0392b')
    applyProp('monogramOpacity', {
      label: String(preset.monogramOpacity ?? 1.0),
      value: preset.monogramOpacity ?? 1.0,
    })
    applyProp('monogramPosition', (preset.monogramPosition ?? 'bottom') as 'top' | 'bottom')
    applyProp('monogramOffset', {
      label: String(preset.monogramOffset ?? 2),
      value: preset.monogramOffset ?? 2,
    })
    applyProp('monogramSize', {
      label: String(preset.monogramSize ?? 4),
      value: preset.monogramSize ?? 4,
    })
    applyProp('textAlign', preset.textAlign as TArtwork['textAlign'])
    applyProp('textVerticalAlign', preset.textVerticalAlign as TArtwork['textVerticalAlign'])
    applyProp('textPadding', { label: String(preset.textPadding), value: preset.textPadding })
    applyProp('textPaddingTop', {
      label: String(preset.textPaddingTop ?? 0),
      value: preset.textPaddingTop ?? 0,
    })
    applyProp('textPaddingBottom', {
      label: String(preset.textPaddingBottom ?? 0),
      value: preset.textPaddingBottom ?? 0,
    })
    applyProp('textPaddingLeft', {
      label: String(preset.textPaddingLeft ?? 0),
      value: preset.textPaddingLeft ?? 0,
    })
    applyProp('textPaddingRight', {
      label: String(preset.textPaddingRight ?? 0),
      value: preset.textPaddingRight ?? 0,
    })
    applyProp('textThickness', {
      label: String(preset.textThickness),
      value: preset.textThickness,
    })
  }

  // Shape properties (for shape presets)
  if (presetType === 'shape') {
    applyProp('shapeType', preset.shapeType)
    applyProp('shapeColor', preset.shapeColor)
    applyProp('shapeOpacity', preset.shapeOpacity)
  }
}
