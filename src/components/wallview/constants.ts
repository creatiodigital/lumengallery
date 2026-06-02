/**
 * Wall view scaling factor: pixels per meter.
 *
 * This value determines how many CSS pixels correspond to 1 meter
 * of wall space. It is used consistently throughout all 2D ↔ 3D
 * conversion logic, position calculations, and measurement displays.
 *
 * At WALL_SCALE = 400, a 5 m wall renders at 2000 px (comfortable
 * at 100 % browser zoom). Users can zoom out to ~10 % for a full
 * overview or zoom in to ~200 % for fine-grained work.
 */
export const WALL_SCALE = 400

/**
 * Calculate total frame + passepartout + paper border width in 2D pixels
 * for a given artwork. Used by alignment, snapping, and grouping
 * to account for the visual extent of the artwork beyond its image area.
 */
export const getArtworkBorderPx = (artwork: {
  showFrame?: boolean
  imageUrl?: string | null
  frameSize?: { value: number } | null
  showPassepartout?: boolean
  passepartoutSize?: { value: number } | null
  showPaperBorder?: boolean
  paperBorderSize?: { value: number } | null
}): number => {
  const scaleMul = WALL_SCALE / 100
  const framePx =
    artwork?.showFrame && artwork?.imageUrl && artwork?.frameSize?.value
      ? artwork.frameSize.value * scaleMul
      : 0
  const ppPx =
    artwork?.showPassepartout && artwork?.imageUrl && artwork?.passepartoutSize?.value
      ? artwork.passepartoutSize.value * scaleMul
      : 0
  const paperPx =
    artwork?.showPaperBorder && artwork?.imageUrl && artwork?.paperBorderSize?.value
      ? artwork.paperBorderSize.value * scaleMul
      : 0
  return framePx + ppPx + paperPx
}
