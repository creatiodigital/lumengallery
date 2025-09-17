type TAlignedArtwork = {
  x: number
  y: number
  width: number
  height: number
}

type HorizontalAlignment = 'top' | 'bottom' | 'center-horizontal' | null
type VerticalAlignment = 'left' | 'right' | 'center-vertical' | null

export interface AlignmentResult {
  horizontal: HorizontalAlignment
  vertical: VerticalAlignment
}

const tolerance = 3

export const areAligned = (
  artworkA: TAlignedArtwork,
  artworkB: TAlignedArtwork,
): AlignmentResult => {
  const directions: AlignmentResult = {
    horizontal: null,
    vertical: null,
  }

  if (Math.abs(artworkA.y - artworkB.y) <= tolerance) {
    directions.horizontal = 'top'
  }

  if (Math.abs(artworkA.y + artworkA.height - (artworkB.y + artworkB.height)) <= tolerance) {
    directions.horizontal = 'bottom'
  }

  if (
    Math.abs(artworkA.y + artworkA.height / 2 - (artworkB.y + artworkB.height / 2)) <= tolerance
  ) {
    directions.horizontal = 'center-horizontal'
  }

  if (Math.abs(artworkA.x - artworkB.x) <= tolerance) {
    directions.vertical = 'left'
  }

  if (Math.abs(artworkA.x + artworkA.width - (artworkB.x + artworkB.width)) <= tolerance) {
    directions.vertical = 'right'
  }

  if (Math.abs(artworkA.x + artworkA.width / 2 - (artworkB.x + artworkB.width / 2)) <= tolerance) {
    directions.vertical = 'center-vertical'
  }

  return directions
}
