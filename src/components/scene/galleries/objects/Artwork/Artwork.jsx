import React from 'react'

import { ArtText } from '@/components/scene/galleries/objects/ArtText'
import { Paint } from '@/components/scene/galleries/objects/Paint'

const Artwork = ({ artwork }) => {
  switch (artwork?.artworkType) {
    case 'paint':
      return <Paint artwork={artwork} />
    case 'text':
      return <ArtText artwork={artwork} />
    default:
      return <div>Unknown artwork type</div>
  }
}

export default Artwork
