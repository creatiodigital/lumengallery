import Image from 'next/image'

import { isSafeImageSrc } from '@/lib/imageSafety'

import styles from './prints.module.scss'

type Props = {
  imageUrl: string | null
  alt: string
}

export const PrintsBanner = ({ imageUrl, alt }: Props) => {
  if (!imageUrl || !isSafeImageSrc(imageUrl)) return null

  return (
    <div className={styles.banner}>
      {/* unoptimized: serve the already-optimized R2/CDN .webp directly; the
          Vercel optimizer's cold re-encode broke images on first load (AR-125). */}
      <Image
        src={imageUrl}
        alt={alt}
        fill
        priority
        unoptimized
        sizes="100vw"
        className={styles.bannerImage}
      />
    </div>
  )
}
