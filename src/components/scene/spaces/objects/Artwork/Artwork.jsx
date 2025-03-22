import React from 'react'

import { ArtisticImage } from '@/components/scene/spaces/objects/ArtisticImage'
import { ArtisticText } from '@/components/scene/spaces/objects/ArtisticText'

const Artwork = ({ artwork }) => {
  switch (artwork?.artworkType) {
    case 'paint':
      return <ArtisticImage artwork={artwork} />
    case 'text':
      return <ArtisticText artwork={artwork} />
    default:
      return <div>Unknown artwork type</div>
  }
}

export default Artwork
