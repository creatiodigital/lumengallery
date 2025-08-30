import React from 'react'

import { Handle } from '@/components/wallview/Handle'
import type { ResizeHandler } from '@/types/wallView'

export type THandles = {
  artworkId: string | ''
  handleResize: ResizeHandler<HTMLDivElement>
}

const Handles = ({ artworkId, handleResize }: THandles) => (
  <>
    <Handle
      direction="top-left"
      onMouseDown={(event) => handleResize(event, artworkId, 'top-left')}
    />
    <Handle
      direction="top-right"
      onMouseDown={(event) => handleResize(event, artworkId, 'top-right')}
    />
    <Handle
      direction="bottom-left"
      onMouseDown={(event) => handleResize(event, artworkId, 'bottom-left')}
    />
    <Handle
      direction="bottom-right"
      onMouseDown={(event) => handleResize(event, artworkId, 'bottom-right')}
    />
  </>
)

export default Handles
