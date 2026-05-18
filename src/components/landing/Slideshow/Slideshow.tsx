import Link from 'next/link'
import { Carousel } from '@/components/ui/Carousel'
import { Text } from '@/components/ui/Typography'

import styles from './Slideshow.module.scss'

type Slide = {
  id: string
  imageUrl: string
  exhibitionUrl: string
  subtitle: string
  title: string
  meta: string
  textColor?: string
}

type SlideshowProps = {
  slides: Slide[]
}

export const Slideshow = ({ slides }: SlideshowProps) => {
  return (
    <div className={styles.slideshow}>
      <Carousel
        dotsClassName={styles.dots}
        slides={slides.map((slide, index) => (
          <Link key={slide.id} href={slide.exhibitionUrl} className={styles.slide}>
            <img
              src={slide.imageUrl}
              alt=""
              className={styles.background}
              loading={index === 0 ? 'eager' : 'lazy'}
            />
            <div className={styles.container}>
              <div className={styles.content} style={{ color: slide.textColor || '#ffffff' }}>
                {slide.meta && (
                  <Text as="p" size="sm" className={styles.meta}>
                    {slide.meta}
                  </Text>
                )}
                <Text as="h2" size="huge" font="serif" className={styles.title}>
                  {slide.title}
                </Text>
                <Text as="p" size="xl" font="serif" className={styles.subtitle}>
                  {slide.subtitle}
                </Text>
              </div>
            </div>
          </Link>
        ))}
      />
    </div>
  )
}

export default Slideshow
