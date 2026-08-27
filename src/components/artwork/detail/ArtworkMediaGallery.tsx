'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import type { ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'
import { reportImageError } from '@/lib/observability/reportImageError'

import styles from './ArtworkMediaGallery.module.scss'

/**
 * The supplementary imagery below the artwork — close-ups, print mockups, an
 * optional short film.
 *
 * The layout follows the COUNT, because controls that move between two images
 * are noise:
 *   0  the zone does not exist at all
 *   1  single, centred
 *   2  side by side
 *   3+ an infinite carousel with peeking neighbours
 *
 * Small viewports never get a carousel — the assets stack vertically and the
 * reader scrolls, which is what a thumb wants to do anyway. That switch is
 * CSS-only: the slide offset is published as a custom property and consumed
 * exclusively inside the desktop media query, so the JS index simply stops
 * mattering rather than having to be undone.
 *
 * Images are `cover` at a fixed 3:2, not `contain`. An asset moves between
 * layouts as more are added, so a shared ratio keeps its crop stable instead of
 * reframing every time the count changes. (The artwork's own image is
 * `contain`, above — that one must never crop.)
 */
/** Must match the CSS transition on `.track`. */
const SLIDE_MS = 400

export const ArtworkMediaGallery = ({ media = [] }: { media?: ArtworkMediaItem[] | null }) => {
  const [index, setIndex] = useState(0)
  // Which way the track is currently travelling: -1, 0 or 1.
  const [shift, setShift] = useState(0)
  const animating = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragStartX = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // A row with no usable URL would render as a broken image on a public page,
  // which is worse than the section simply not existing. Guarded here rather
  // than trusted from the query, because these rows are written by an upload
  // that can fail between storing the object and recording it.
  const usable = (media ?? []).filter((m) => typeof m.url === 'string' && m.url.trim().length > 0)

  // Nothing added to this work — the normal case, not a degraded one. Render as
  // though the section were never designed: no heading, no frame, no divider.
  if (usable.length === 0) return null

  const isCarousel = usable.length >= 3

  /**
   * Slide one step, then re-centre without animating.
   *
   * The window is re-rendered around the new index at the same instant the
   * transform returns to zero — with the transition switched off for that frame,
   * so the content moves by exactly the distance the transform gives back and
   * the eye sees one continuous slide rather than a rewind.
   *
   * Ignored while a step is in flight: two overlapping animations would land the
   * index somewhere neither click asked for.
   */
  const step = (delta: number) => {
    if (animating.current) return
    animating.current = true
    setShift(delta)
    timer.current = setTimeout(() => {
      setIndex((i) => (i + delta + usable.length) % usable.length)
      setShift(0)
      animating.current = false
    }, SLIDE_MS)
  }

  // A true ring: the slide before the active one is whatever precedes it in the
  // sequence, wrapping round the end. With three assets and the first centred,
  // the left peek is the THIRD and the right peek is the second.
  //
  // Rendered as a rotated window rather than by sliding a long track, because a
  // track cannot put the last slide to the LEFT of the first — that is exactly
  // the wrap a carousel needs, and the reason "infinite" tracks are usually
  // built from cloned slides.
  //
  // FIVE, not three. With only the two neighbours rendered, sliding one step
  // uncovered empty space where a fourth slide should have been — a white flash
  // on every click. The outer pair is never seen at rest; it exists so there is
  // always something to move into view.
  const at = (offset: number) => usable[(index + offset + usable.length) % usable.length]
  const visible = isCarousel ? [at(-2), at(-1), at(0), at(1), at(2)] : usable

  /** The active slide sits in the middle of that window, offset by any click
   *  currently in flight. */
  const activePosition = 2 + shift

  return (
    <section className={styles.gallery} data-count={usable.length}>
      <div
        className={styles.viewport}
        // Drag to move — finger, pen or mouse, through one path. On a phone
        // there are no arrows at all, so this IS the control; on a desktop it
        // sits alongside them for anyone who reaches for a trackpad.
        //
        // `touch-action: pan-y` in the stylesheet keeps VERTICAL scrolling with
        // the browser, so a reader scrolling the page past the carousel is never
        // caught by it.
        onPointerDown={(e) => {
          dragStartX.current = e.clientX
        }}
        onPointerUp={(e) => {
          const from = dragStartX.current
          dragStartX.current = null
          if (from === null || !isCarousel) return
          const delta = e.clientX - from
          // Below this it is a click or a stray movement, not an intent to move.
          if (Math.abs(delta) < 40) return
          step(delta < 0 ? 1 : -1)
        }}
        onPointerCancel={() => {
          dragStartX.current = null
        }}
        data-layout={usable.length === 1 ? 'single' : usable.length === 2 ? 'pair' : 'carousel'}
      >
        <div
          className={styles.track}
          // Transition only while travelling. On the frame that re-centres it
          // must be off, or the track would visibly slide back.
          data-sliding={shift !== 0 ? 'true' : undefined}
          style={{ '--shift': shift } as React.CSSProperties}
        >
          {visible.map((item, position) => (
            <figure
              // Position, not id: with fewer than three distinct assets in the
              // window the same item can appear twice, and React needs the keys
              // to stay unique.
              key={`${item.id}-${position}`}
              className={styles.slide}
              // Follows the CLICK, not the index. The index only updates once
              // the slide has landed, so keying off it left the incoming image
              // dim for the whole journey and then snapped it to full on
              // arrival. Offsetting by `shift` starts the fade the moment the
              // arrow is pressed, so it brightens as it travels.
              data-active={isCarousel ? position === activePosition : undefined}
              aria-hidden={isCarousel && position !== activePosition}
            >
              {item.kind === 'video' ? (
                <ArtworkMediaVideo url={item.url} />
              ) : (
                <img
                  src={item.url}
                  alt={item.caption ?? ''}
                  width={item.width ?? undefined}
                  height={item.height ?? undefined}
                  className={styles.media}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  onError={() => reportImageError(item.url, { surface: 'artwork-media' })}
                />
              )}
              {/* Plain text, escaped by React. Never HTML. */}
              {item.caption && (
                <figcaption className={styles.caption}>
                  <Text as="span" size="sm">
                    {item.caption}
                  </Text>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>

      {isCarousel && (
        <div className={styles.controls}>
          <Button
            variant="bare"
            icon="arrowLeft"
            aria-label="Previous image"
            onClick={() => step(-1)}
            className={styles.control}
          />
          <Button
            variant="bare"
            icon="arrowRight"
            aria-label="Next image"
            onClick={() => step(1)}
            className={styles.control}
          />
        </div>
      )}
    </section>
  )
}

/**
 * A silent, looping clip with one control.
 *
 * `muted` is set through the ref rather than as a prop because React assigns it
 * as a property and does not reflect it to the attribute — and an unmuted video
 * is refused autoplay by every browser, so the clip would simply never start.
 * `playsInline` keeps iOS from hijacking the whole screen.
 *
 * A visitor who has asked for reduced motion gets a still first frame and the
 * play button, not a moving image they did not consent to.
 */
const ArtworkMediaVideo = ({ url }: { url: string }) => {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.muted = true
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      el.pause()
      setPlaying(false)
    } else {
      // Autoplay can still be refused; reflect what actually happened rather
      // than showing a pause button over a static frame.
      el.play().catch(() => setPlaying(false))
    }
  }, [])

  const toggle = () => {
    const el = ref.current
    if (!el) return
    if (el.paused) {
      el.play().catch(() => setPlaying(false))
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }

  return (
    <div className={styles.videoWrap}>
      <video
        ref={ref}
        src={url}
        className={styles.media}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      />
      <Button
        variant="bare"
        icon={playing ? 'pause' : 'play'}
        aria-label={playing ? 'Pause video' : 'Play video'}
        onClick={toggle}
        className={styles.videoControl}
      />
    </div>
  )
}
