import { ImageResponse } from 'next/og'

import { Monogram } from '@/components/brand/BrandMarks'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      }}
    >
      <Monogram width={132} height={141} />
    </div>,
    { ...size },
  )
}
