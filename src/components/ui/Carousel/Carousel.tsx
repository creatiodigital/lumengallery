'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import c from 'classnames'

import styles from './Carousel.module.scss'

type CarouselProps = {
  slides: ReactNode[]
  interval?: number
  className?: string
  dotsClassName?: string
}

const Carousel = ({ slides, interval = 5000, className, dotsClassName }: CarouselProps) => {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % slides.length)
    }, interval)
    return () => window.clearInterval(id)
  }, [slides.length, interval])

  return (
    <div className={c(styles.carousel, className)}>
      {slides.map((slide, index) => (
        <div
          key={index}
          className={c(styles.slide, index === activeIndex && styles.slideActive)}
        >
          {slide}
        </div>
      ))}
      {slides.length > 1 && (
        <div className={c(styles.dots, dotsClassName)}>
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

export default Carousel
