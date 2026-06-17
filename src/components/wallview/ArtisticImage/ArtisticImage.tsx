'use client'

import { Icon } from '@/components/ui/Icon'
import { Tooltip } from '@/components/ui/Tooltip'
import type { TArtwork } from '@/types/artwork'

import { WALL_SCALE } from '@/components/wallview/constants'
import { assetUrl } from '@/lib/assetUrl'

import styles from './ArtisticImage.module.scss'

type ArtisticImageProps = {
  artwork: TArtwork
}

const ArtisticImage = ({ artwork }: ArtisticImageProps) => {
  const {
    showFrame,
    frameColor,
    frameSize,
    frameMaterial,
    frameTextureScale,
    frameTextureRotation,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    showPaperBorder,
    paperBorderSize,
  } = artwork

  const frameFolder = (
    frameMaterial === 'wood' ? 'wood-dark' : (frameMaterial ?? 'wood-dark')
  ).replace('wood-', '')
  const frameTextureUrl = assetUrl(`/assets/materials/wooden-frame-${frameFolder}/diffuse.jpg`)

  return (
    <div
      className={styles.frame}
      style={{
        ...(showFrame && imageUrl && (frameMaterial ?? 'plastic') === 'plastic'
          ? {
              border: `${(frameSize?.value ?? 3) * (WALL_SCALE / 100)}px solid ${frameColor ?? '#000000'}`,
            }
          : showFrame && imageUrl && frameMaterial?.startsWith('wood')
            ? {
                padding: `${(frameSize?.value ?? 3) * (WALL_SCALE / 100)}px`,
                position: 'relative' as const,
                overflow: 'hidden' as const,
              }
            : {}),
      }}
    >
      {/* Wood frame backdrop: always show texture, paint overlays with opacity */}
      {showFrame && imageUrl && frameMaterial?.startsWith('wood') && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: '-50%',
              width: '200%',
              height: '200%',
              backgroundImage: `url('${frameTextureUrl}')`,
              backgroundSize: `${(frameTextureScale ?? 2) * 25}%`,
              backgroundPosition: '50% 50%',
              backgroundRepeat: 'repeat',
              transform: `rotate(${frameTextureRotation ?? 0}deg)`,
              transformOrigin: 'center center',
              zIndex: 0,
              pointerEvents: 'none' as const,
            }}
          />
          {/* Paint overlay — uses opacity so ALL colors (incl. white) work */}
          {frameColor && frameColor !== '#ffffff' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: frameColor,
                opacity: 0.75,
                zIndex: 0,
                pointerEvents: 'none' as const,
              }}
            />
          )}
        </>
      )}
      <div
        className={styles.passepartout}
        style={{
          border:
            showPassepartout && imageUrl && passepartoutSize
              ? `${passepartoutSize.value * (WALL_SCALE / 100)}px solid ${passepartoutColor}`
              : undefined,
          ...(showFrame && frameMaterial?.startsWith('wood')
            ? { position: 'relative' as const, zIndex: 1 }
            : {}),
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            border:
              showPaperBorder && imageUrl && paperBorderSize?.value
                ? `${paperBorderSize.value * (WALL_SCALE / 100)}px solid #ffffff`
                : undefined,
          }}
        >
          <div
            className={styles.image}
            style={{
              backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
            }}
          >
            {!imageUrl && (
              <div className={styles.empty}>
                <Tooltip label="Upload an image via the artwork library" placement="top">
                  <span style={{ display: 'inline-flex' }}>
                    <Icon name="image" size={40} color="#000000" />
                  </span>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArtisticImage
