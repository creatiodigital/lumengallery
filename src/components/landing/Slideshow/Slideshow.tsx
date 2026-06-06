'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import c from 'classnames'
import { Text } from '@/components/ui/Typography'
import { reportImageError } from '@/lib/observability/reportImageError'

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
  interval?: number
}

export const Slideshow = ({ slides, interval = 5000 }: SlideshowProps) => {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % slides.length)
    }, interval)
    return () => window.clearInterval(id)
  }, [slides.length, interval])

  return (
    <div className={styles.slideshow}>
      {slides.map((slide, index) => (
        <Link
          key={slide.id}
          href={slide.exhibitionUrl}
          className={c(styles.slide, index === activeIndex && styles.slideActive)}
        >
          <img
            src={slide.imageUrl}
            alt=""
            className={styles.background}
            loading={index === 0 ? 'eager' : 'lazy'}
            onError={() => reportImageError(slide.imageUrl, { surface: 'home-slideshow' })}
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
      {slides.length > 1 && (
        <div className={styles.dots}>
          {slides.map((_, index) => (
            <span
              key={index}
              className={c(styles.dot, index === activeIndex && styles.dotActive)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Slideshow
