import React from 'react'

import { Display } from '@/components/scene/spaces/objects/Display'
import { Stencil } from '@/components/scene/spaces/objects/Stencil'
import type { RuntimeArtwork } from '@/utils/artworkTransform'

interface ArtObjectProps {
  artwork: RuntimeArtwork
}

const ArtObject: React.FC<ArtObjectProps> = ({ artwork }) => {
  switch (artwork.artworkType) {
    case 'image':
      return <Display artwork={artwork} />
    case 'text':
      return <Stencil artwork={artwork} />
    default:
      return <div>Unknown artwork type</div>
  }
}

export default ArtObject
