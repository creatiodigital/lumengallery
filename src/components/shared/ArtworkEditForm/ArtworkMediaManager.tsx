'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Video } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { MAX_ARTWORK_MEDIA, type ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'

import styles from './ArtworkMediaManager.module.scss'

/**
 * Supplementary media for an artwork page — close-ups, print mockups, an
 * optional short film.
 *
 * ADMIN ONLY, and deliberately narrower than the main image beside it: the work
 * is the artist's, this is the gallery's sales presentation.
 *
 * Uploads follow the house pattern — ask the server for a presigned URL, PUT
 * the file straight to R2, then tell the server it landed. The server never
 * takes a URL from here, only the key it minted itself.
 */
const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm'

/** Below this the asset is soft on a retina screen at full width. */
const MIN_IMAGE_LONG_EDGE = 2000

export const ArtworkMediaManager = ({ artworkId }: { artworkId: string }) => {
  const [media, setMedia] = useState<ArtworkMediaItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/artwork-media?artworkId=${artworkId}`)
    if (res.ok) setMedia((await res.json()).media)
  }, [artworkId])

  useEffect(() => {
    void load()
  }, [load])

  /** Real pixel size, so the row can reserve the right slot and we can warn
   *  about an image too small to stay sharp. Videos carry no dimensions here. */
  const measure = (file: File) =>
    new Promise<{ width?: number; height?: number }>((resolve) => {
      if (!file.type.startsWith('image/')) return resolve({})
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({})
      }
      img.src = url
    })

  const upload = async (files: FileList) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    const soft: string[] = []

    for (const file of Array.from(files)) {
      try {
        const { width, height } = await measure(file)
        if (width && height && Math.max(width, height) < MIN_IMAGE_LONG_EDGE) {
          soft.push(`${file.name} (${width}×${height})`)
        }

        const reqRes = await fetch('/api/artwork-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'request-upload',
            artworkId,
            contentType: file.type,
            fileSize: file.size,
          }),
        })
        if (!reqRes.ok) throw new Error((await reqRes.json()).error ?? 'Upload refused')
        const { presignedUrl, key } = await reqRes.json()

        const put = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        })
        if (!put.ok) throw new Error('The file could not be sent to storage')

        // Only the key goes back — the server rebuilds the URL from it.
        const doneRes = await fetch('/api/artwork-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'complete', artworkId, key, width, height }),
        })
        if (!doneRes.ok) throw new Error((await doneRes.json()).error ?? 'Upload failed')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
        break
      }
    }

    if (soft.length > 0) {
      setNotice(
        `Uploaded, but small for full-width display — ${soft.join(', ')}. ${MIN_IMAGE_LONG_EDGE}px on the long edge is the minimum; 3000–4000px keeps a print detail sharp.`,
      )
    }
    await load()
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = async (id: string) => {
    setBusy(true)
    setError(null)
    // The row id, never a key or a URL: the server resolves the object from its
    // own row so nothing chosen here can reach the bucket.
    const res = await fetch('/api/artwork-media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) setError((await res.json()).error ?? 'Could not remove that file')
    await load()
    setBusy(false)
  }

  const full = media.length >= MAX_ARTWORK_MEDIA

  return (
    <div className={styles.manager}>
      <Text as="p" size="sm" className={styles.hint}>
        Shown below the artwork on its page. One image sits alone, two sit side by side, three or
        more become a carousel. Leave it empty and the section does not appear at all.
      </Text>

      {media.length > 0 && (
        <ul className={styles.grid}>
          {media.map((item) => (
            <li key={item.id} className={styles.item}>
              {item.kind === 'video' ? (
                <video
                  src={item.url}
                  className={styles.thumb}
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img src={item.url} alt={item.caption ?? ''} className={styles.thumb} />
              )}
              {item.kind === 'video' && (
                <span className={styles.badge}>
                  <Video size={12} strokeWidth={ICON_STROKE_WIDTH} aria-hidden /> Video
                </span>
              )}
              <Button
                font="dashboard"
                variant="secondary"
                size="small"
                label="Remove"
                icon="trash-2"
                disabled={busy}
                onClick={() => remove(item.id)}
                className={styles.remove}
              />
            </li>
          ))}
        </ul>
      )}

      {/* The native control is hidden and driven by our own Button — a bare
          file input is the one form control browsers refuse to style, and it
          would be the only unstyled thing on the page. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className={styles.input}
        tabIndex={-1}
        onChange={(e) => e.target.files && e.target.files.length > 0 && upload(e.target.files)}
      />

      <div className={styles.actions}>
        <Button
          font="dashboard"
          variant="secondary"
          label={busy ? 'Uploading…' : media.length > 0 ? 'Add more' : 'Add images or video'}
          icon="plus"
          disabled={busy || full}
          onClick={() => inputRef.current?.click()}
        />
        <Text as="span" size="sm" className={styles.count}>
          {full
            ? `Limit reached (${MAX_ARTWORK_MEDIA}) — remove one to add another`
            : media.length === 0
              ? 'Add as many as you like'
              : `${media.length} added`}
        </Text>
      </div>
      {notice && (
        <Text as="p" size="sm" className={styles.notice}>
          {notice}
        </Text>
      )}
      {error && (
        <Text as="p" size="sm" className={styles.error}>
          {error}
        </Text>
      )}
    </div>
  )
}
