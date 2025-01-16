import React from 'react'

import { ArtisticImage } from '@/components/scene/galleries/objects/ArtisticImage'
import { ArtisticText } from '@/components/scene/galleries/objects/ArtisticText'

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
