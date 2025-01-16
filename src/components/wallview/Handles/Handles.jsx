import React from 'react'

import { Handle } from '@/components/wallview/Handle'

const Handles = ({ artworkId, handleResize }) => (
  <>
    <Handle
      direction="topLeft"
      onMouseDown={(event) => handleResize(event, artworkId, 'top-left')}
    />
    <Handle
      direction="topRight"
      onMouseDown={(event) => handleResize(event, artworkId, 'top-right')}
    />
    <Handle
      direction="bottomLeft"
      onMouseDown={(event) => handleResize(event, artworkId, 'bottom-left')}
    />
    <Handle
      direction="bottomRight"
      onMouseDown={(event) => handleResize(event, artworkId, 'bottom-right')}
    />
  </>
)

export default Handles
