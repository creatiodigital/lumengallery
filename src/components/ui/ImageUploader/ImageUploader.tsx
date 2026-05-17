'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { FileInput } from '@/components/ui/FileInput'
import { MAX_UPLOAD_SIZE, MIN_IMAGE_WIDTH, MIN_IMAGE_HEIGHT } from '@/lib/imageConfig'

import styles from './ImageUploader.module.scss'

type ImageMeta = {
  width: number
  height: number
  format: string
  sizeBytes: number
  dpi?: number | null
}

export type { ImageMeta }

type ImageUploaderProps = {
  imageUrl?: string | null
  /**
   * Called once a file is selected and validated. The second arg is an
   * optional preview blob URL — supplied for formats the browser can't
   * render directly (TIFF). When present, the parent should use it for
   * the preview instead of building its own `URL.createObjectURL(file)`.
   * The `file` is always the unmodified original.
   */
  onUpload: (file: File, previewUrl?: string) => Promise<void>
  onRemove?: () => void | Promise<void>
  onMetaChange?: (meta: ImageMeta | null) => void
  displayMeta?: ImageMeta | null
  uploading?: boolean
  loadingText?: string
  aspectRatio?: string
  objectFit?: 'cover' | 'contain'
  placeholder?: string
  maxSizeBytes?: number
  minWidth?: number
  minHeight?: number
  /**
   * When true, the preview/dropzone ignores aspectRatio and stretches to
   * fill whatever vertical space its parent gives it (via flex-grow).
   * Use from layouts where two uploaders need to visually match height
   * regardless of their parents' description lengths.
   */
  fill?: boolean
  /**
   * External error (e.g. from a failed server-side upload). Rendered
   * inline right below the dropzone in the same style as the built-in
   * size/resolution errors, so users see feedback where they are.
   */
  error?: string | null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// Whitelist of MIME types both print providers accept. The Print Space
// only takes JPEG, PNG and TIFF, matching theprintspace's
// the safe intersection.
const ACCEPTED_MIME_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/tiff'])

const ACCEPT_ATTR = 'image/jpeg,image/png,image/tiff'

function formatFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/tiff': 'TIFF',
  }
  return map[mime] || mime.replace('image/', '').toUpperCase()
}

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = src
  })
}

// Decode a TIFF file into a downsampled JPEG blob URL for preview.
// Browsers can't render TIFF in an <img>, so for .tif uploads we decode
// the pixels client-side with utif and re-encode as JPEG. The full-res
// TIFF still uploads to R2 unchanged — this URL is preview-only.
//
// Downsamples to max 2048 px on the longest side so the preview JPEG
// stays small enough to display quickly. utif loads dynamically so it
// only ships with the upload route, not the rest of the app.
async function getTiffPreviewUrl(file: File): Promise<string | null> {
  try {
    const UTIF = (await import('utif')).default
    const buf = await file.arrayBuffer()
    const ifds = UTIF.decode(buf)
    if (!ifds.length) return null
    const ifd = ifds[0]
    UTIF.decodeImage(buf, ifd)
    const rgba = UTIF.toRGBA8(ifd)
    const width = ifd.width
    const height = ifd.height
    if (!width || !height) return null

    const fullCanvas = document.createElement('canvas')
    fullCanvas.width = width
    fullCanvas.height = height
    const fullCtx = fullCanvas.getContext('2d')
    if (!fullCtx) return null
    const imgData = fullCtx.createImageData(width, height)
    imgData.data.set(rgba)
    fullCtx.putImageData(imgData, 0, 0)

    const MAX_PREVIEW_DIM = 2048
    const scale = Math.min(1, MAX_PREVIEW_DIM / Math.max(width, height))
    let outCanvas = fullCanvas
    if (scale < 1) {
      outCanvas = document.createElement('canvas')
      outCanvas.width = Math.round(width * scale)
      outCanvas.height = Math.round(height * scale)
      const outCtx = outCanvas.getContext('2d')
      if (!outCtx) return null
      outCtx.drawImage(fullCanvas, 0, 0, outCanvas.width, outCanvas.height)
    }

    const blob: Blob | null = await new Promise((resolve) =>
      outCanvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}

// Browsers can't decode TIFF in an <img> element, so getImageDimensions
// returns 0×0 for .tif uploads. Parse the TIFF header directly to read
// the first IFD's ImageWidth/ImageLength tags. Plain (non-Big) TIFF only —
// BigTIFF (magic 43) returns 0×0 and the caller treats it as unknown.
//
// Photoshop-saved TIFFs (and others) often write image data first and
// place the IFD near the end of the file — sometimes tens of MB in.
// Read the 8-byte header, then seek to the IFD offset and pull just
// what's needed, instead of pre-loading a fixed window from the start.
async function getTiffDimensions(file: File): Promise<{ width: number; height: number }> {
  try {
    const headerBuf = await file.slice(0, 8).arrayBuffer()
    if (headerBuf.byteLength < 8) return { width: 0, height: 0 }
    const hView = new DataView(headerBuf)
    const bo = hView.getUint16(0, false)
    const le = bo === 0x4949 ? true : bo === 0x4d4d ? false : null
    if (le === null) return { width: 0, height: 0 }
    if (hView.getUint16(2, le) !== 42) return { width: 0, height: 0 }
    const ifdOffset = hView.getUint32(4, le)
    if (ifdOffset + 2 > file.size) return { width: 0, height: 0 }

    const countBuf = await file.slice(ifdOffset, ifdOffset + 2).arrayBuffer()
    if (countBuf.byteLength < 2) return { width: 0, height: 0 }
    const entryCount = new DataView(countBuf).getUint16(0, le)
    if (entryCount === 0 || entryCount > 4096) return { width: 0, height: 0 }

    const entriesStart = ifdOffset + 2
    const entriesLen = entryCount * 12
    const entriesBuf = await file.slice(entriesStart, entriesStart + entriesLen).arrayBuffer()
    if (entriesBuf.byteLength < entriesLen) return { width: 0, height: 0 }
    const eView = new DataView(entriesBuf)

    let width = 0
    let height = 0
    for (let i = 0; i < entryCount; i++) {
      const off = i * 12
      const tag = eView.getUint16(off, le)
      const type = eView.getUint16(off + 2, le)
      const valueOffset = off + 8
      const value =
        type === 3 ? eView.getUint16(valueOffset, le) : type === 4 ? eView.getUint32(valueOffset, le) : 0
      if (tag === 256) width = value
      else if (tag === 257) height = value
      if (width && height) break
    }
    return { width, height }
  } catch {
    return { width: 0, height: 0 }
  }
}

export const ImageUploader = ({
  imageUrl,
  onUpload,
  onRemove,
  onMetaChange,
  displayMeta,
  uploading = false,
  loadingText = 'Uploading...',
  aspectRatio = '16 / 10',
  objectFit = 'cover',
  placeholder: _placeholder = 'No image',
  maxSizeBytes = MAX_UPLOAD_SIZE,
  minWidth = MIN_IMAGE_WIDTH,
  minHeight = MIN_IMAGE_HEIGHT,
  fill = false,
  error,
}: ImageUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)
  const [resolutionError, setResolutionError] = useState<string | null>(null)
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null)
  // Set while the file is being validated and (for TIFFs) decoded to
  // a preview JPEG. The decode for a 60 MB TIFF takes several seconds —
  // gives the user feedback that something is happening.
  const [preparing, setPreparing] = useState(false)

  // Load metadata for existing images (from URL)
  useEffect(() => {
    if (!imageUrl) {
      setImageMeta(null)
      onMetaChange?.(null)
      return
    }

    // Skip blob URLs — metadata for those is set during upload
    if (imageUrl.startsWith('blob:')) return

    getImageDimensions(imageUrl).then(({ width, height }) => {
      if (width === 0 || height === 0) {
        setImageMeta(null)
        onMetaChange?.(null)
        return
      }
      const meta = { width, height, format: 'WebP', sizeBytes: 0 }
      setImageMeta(meta)
      onMetaChange?.(meta)
    })
  }, [imageUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const validateFile = useCallback(
    async (file: File): Promise<boolean> => {
      setSizeError(null)
      setResolutionError(null)

      // Check MIME type. The browser's `accept` attribute is a hint, not
      // a hard gate — drag-and-drop bypasses it entirely. Reject anything
      // outside the print-provider intersection here too.
      if (file.type && !ACCEPTED_MIME_TYPES.has(file.type)) {
        setSizeError('Invalid file type. Accepted: JPG, PNG, TIFF.')
        return false
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
        const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(0)
        setSizeError(`File is too large (${sizeMB}MB). Maximum size is ${maxMB}MB.`)
        return false
      }

      // Check resolution. TIFFs need a header parse — <img> can't decode
      // them. Detect by MIME *or* extension because drag-drop and some
      // Mac source apps surface .tif files with an empty/wrong MIME.
      const lowerName = file.name.toLowerCase()
      const isTiff =
        file.type === 'image/tiff' || lowerName.endsWith('.tif') || lowerName.endsWith('.tiff')
      const url = URL.createObjectURL(file)
      try {
        const { width, height } = isTiff
          ? await getTiffDimensions(file)
          : await getImageDimensions(url)
        if (minWidth > 0 && minHeight > 0 && (width < minWidth || height < minHeight)) {
          setResolutionError(
            `Image is too small (${height} × ${width} px). Minimum resolution is ${minHeight} × ${minWidth} px.`,
          )
          return false
        }
        const meta = {
          width,
          height,
          format: formatFromMime(file.type),
          sizeBytes: file.size,
        }
        setImageMeta(meta)
        onMetaChange?.(meta)
      } finally {
        URL.revokeObjectURL(url)
      }

      return true
    },
    [maxSizeBytes, minWidth, minHeight, onMetaChange],
  )

  const prepareAndUpload = useCallback(
    async (file: File) => {
      setPreparing(true)
      try {
        const valid = await validateFile(file)
        if (!valid) return
        const lowerName = file.name.toLowerCase()
        const isTiff =
          file.type === 'image/tiff' || lowerName.endsWith('.tif') || lowerName.endsWith('.tiff')
        const previewUrl = isTiff ? (await getTiffPreviewUrl(file)) ?? undefined : undefined
        await onUpload(file, previewUrl)
      } finally {
        setPreparing(false)
      }
    },
    [onUpload, validateFile],
  )

  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) await prepareAndUpload(file)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [prepareAndUpload],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const file = e.dataTransfer.files?.[0]
      if (!file) return
      // Drag-drop can surface .tif files with empty file.type; the
      // startsWith('image/') check would drop them. Allow if the
      // extension is one we accept too.
      const lowerName = file.name.toLowerCase()
      const isTiffByName = lowerName.endsWith('.tif') || lowerName.endsWith('.tiff')
      if (file.type.startsWith('image/') || isTiffByName) {
        await prepareAndUpload(file)
      }
    },
    [prepareAndUpload],
  )

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleRemove = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (onRemove) {
        await onRemove()
        setImageMeta(null)
        onMetaChange?.(null)
      }
    },
    [onRemove, onMetaChange],
  )

  // When `fill` is set, drop the aspect-ratio constraint and rely on
  // the parent flex container to dictate height. A min-height keeps the
  // dropzone usable even if the parent collapses to a small size.
  const boxStyle = fill ? ({ flex: 1, minHeight: 220 } as const) : ({ aspectRatio } as const)
  const containerClass = fill ? `${styles.container} ${styles.containerFill}` : styles.container

  return (
    <div className={containerClass}>
      <FileInput
        ref={fileInputRef}
        id="image-uploader-file"
        accept={ACCEPT_ATTR}
        onChange={handleFileSelect}
        className={styles.hiddenInput}
      />

      {imageUrl ? (
        // Image preview state
        <div className={styles.preview} style={boxStyle}>
          <Image src={imageUrl} alt="Uploaded image" fill style={{ objectFit }} />
          {onRemove && (
            <Button
              variant="ghost"
              icon="close"
              onClick={handleRemove}
              disabled={uploading}
              className={styles.removeButton}
              aria-label="Remove image"
            />
          )}
          {(uploading || preparing) && (
            <div className={styles.uploadingOverlay}>
              <span className={styles.spinner} aria-hidden />
              <span>{preparing ? 'Preparing preview…' : loadingText}</span>
            </div>
          )}
        </div>
      ) : (
        // Dropzone state
        <div
          className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
          style={boxStyle}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        >
          {uploading || preparing ? (
            <span className={styles.uploadingText}>
              <span className={styles.spinner} aria-hidden />
              {preparing ? 'Preparing preview…' : loadingText}
            </span>
          ) : (
            <>
              <Button
                font="dashboard"
                variant="primary"
                label="Select a File"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClick()
                }}
                type="button"
              />
              <span className={styles.dropText}>or drag and drop files</span>
            </>
          )}
        </div>
      )}

      {/* Image metadata — prefer displayMeta (server-known original) over internal CDN meta */}
      {(() => {
        const meta = displayMeta ?? imageMeta
        if (!meta || !imageUrl || meta.width <= 0) return null
        return (
          <div className={styles.imageMeta}>
            {displayMeta && <span className={styles.imageMetaLabel}>Original file:</span>}
            <span>
              {meta.height} × {meta.width} px
            </span>
            <span>{meta.format}</span>
            {meta.sizeBytes > 0 && <span>{formatFileSize(meta.sizeBytes)}</span>}
          </div>
        )
      })()}

      {sizeError && <div className={styles.sizeError}>{sizeError}</div>}
      {resolutionError && <div className={styles.sizeError}>{resolutionError}</div>}
      {error && <div className={styles.sizeError}>{error}</div>}
    </div>
  )
}

export default ImageUploader
