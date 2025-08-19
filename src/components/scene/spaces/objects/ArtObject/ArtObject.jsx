import React from 'react'

import { Display } from '@/components/scene/spaces/objects/Display'
import { Stencil } from '@/components/scene/spaces/objects/Stencil'

const ArtObject = ({ artwork }) => {
  switch (artwork?.artworkType) {
    case 'paint':
      return <Display artwork={artwork} />
    case 'text':
      return <Stencil artwork={artwork} />
    default:
      return <div>Unknown artwork type</div>
  }
}

export default ArtObject
