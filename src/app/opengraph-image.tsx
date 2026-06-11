import { ImageResponse } from 'next/og'

import { Monogram, Wordmark } from '@/components/brand/BrandMarks'

export const alt = 'The Art Room'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        gap: '56px',
      }}
    >
      <Monogram width={188} height={200} />
      <Wordmark width={560} height={165} />
    </div>,
    { ...size },
  )
}
