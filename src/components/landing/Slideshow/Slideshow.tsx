'use client'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Pagination } from 'swiper/modules'
import Link from 'next/link'
import { Text } from '@/components/ui/Typography'
import 'swiper/css'
import 'swiper/css/pagination'

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
      <Swiper
        modules={[Autoplay, Pagination]}
        spaceBetween={0}
        slidesPerView={1}
        loop
        speed={800}
        // Slides are 100% width and the height is CSS-driven, so we don't
        // need Swiper to re-measure during every resize tick. Both defaults
        // (updateOnWindowResize, resizeObserver) cause the carousel to
        // flash on every pixel of a drag-resize. Disabling both makes the
        // resize smooth and costs us nothing for this layout.
        updateOnWindowResize={false}
        resizeObserver={false}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        pagination={{
          clickable: true,
          el: `.${styles.pagination}`,
          bulletClass: styles.bullet,
          bulletActiveClass: styles.bulletActive,
        }}
        className={styles.swiper}
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.id}>
            <Link href={slide.exhibitionUrl} className={styles.slide}>
              <div
                className={styles.background}
                style={{ backgroundImage: `url(${slide.imageUrl})` }}
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
          </SwiperSlide>
        ))}
      </Swiper>
      {slides.length > 1 && (
        <div className={styles.paginationContainer}>
          <div className={styles.pagination} />
        </div>
      )}
    </div>
  )
}

export default Slideshow
