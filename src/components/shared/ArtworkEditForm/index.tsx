'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { ErrorText } from '@/components/ui/ErrorText'
import { FileInput } from '@/components/ui/FileInput'
import { Icon } from '@/components/ui/Icon'
import { ImageUploader } from '@/components/ui/ImageUploader'
import type { ImageMeta } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal/Modal'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Text } from '@/components/ui/Typography'
import {
  MIN_DPI,
  TPS_FRAME_TYPES,
  TPS_PAPERS,
  TPS_WINDOW_MOUNTS,
  formatPrintSize,
  getPrintMaxSize,
  getPrintMinSize,
} from '@/lib/print-providers/printspace'
import type { PrintRecommendations, PrintRestrictions } from '@/lib/print-providers'
import {
  MAX_ARTWORK_UPLOAD_SIZE,
  MIN_ARTWORK_IMAGE_WIDTH,
  MIN_ARTWORK_IMAGE_HEIGHT,
  MIN_PRINT_WIDTH,
  MIN_PRINT_HEIGHT,
} from '@/lib/imageConfig'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import styles from './ArtworkEditForm.module.scss'

// Strip HTML tags from text content (for content saved with RichTextEditor previously)
export const stripHtml = (html: string): string => {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Replace ampersands
    .replace(/&lt;/g, '<') // Replace less than
    .replace(/&gt;/g, '>') // Replace greater than
    .replace(/&quot;/g, '"') // Replace quotes
    .trim()
}

export type Artwork = {
  id: string
  userId: string
  name: string
  artworkType: string
  title: string | null
  author: string | null
  year: string | null
  technique: string | null
  dimensions: string | null
  description: string | null
  imageUrl: string | null
  originalImageUrl: string | null
  originalDpi: number | null
  textContent: string | null
  soundUrl: string | null
  featured: boolean
  hiddenFromExhibition: boolean
  printEnabled?: boolean
  printPriceCents?: number | null
  printEditionLimited?: boolean
  printEditionTotal?: number | null
  /**
   * Artist-set veto/allow-list for printing options. Canonical
   * `PrintRestrictions` shape: `{ allowed: { dimensionId: ids[] } }`.
   * Stored as JSON; the page route + payment-intent re-check both
   * read it.
   */
  printOptions?: PrintRestrictions | null
  /**
   * Artist-set "recommended" paper IDs. Soft hint — surfaces a
   * check-circle in the buyer's paper picker but does NOT filter
   * availability. Stored as JSON. Canonical shape: `{ paper: string[] }`.
   */
  printRecommendations?: PrintRecommendations | null
}

export type ArtworkFormData = {
  name: string
  artworkType: string
  title: string
  author: string
  year: string
  technique: string
  dimensions: string
  description: string
  textContent: string
  featured: boolean
  hiddenFromExhibition: boolean
  printEnabled: boolean
  /** Euros as a string for the input field; converted to cents at submit. */
  printPriceEuros: string
  /** Whether this artwork is a limited series — surfaces a numbered-edition
   *  note in the buyer wizard. */
  printEditionLimited: boolean
  /** Total prints in the series. Empty string when unset. Number-as-string
   *  for the input field; parsed at submit. Meaningful only when
   *  `printEditionLimited` is true. */
  printEditionTotal: string
  /**
   * Artist-set restrictions in canonical PrintRestrictions shape.
   * `null` = no restrictions (all options offered).
   */
  printOptions: PrintRestrictions | null
  /**
   * Artist-set paper recommendations. `null` = nothing recommended,
   * wizard shows no checkmarks. Today only `paper` is meaningful.
   */
  printRecommendations: PrintRecommendations | null
}

export const getInitialFormData = (): ArtworkFormData => ({
  name: '',
  artworkType: 'image',
  title: '',
  author: '',
  year: '',
  technique: '',
  dimensions: '',
  description: '',
  textContent: '',
  featured: false,
  hiddenFromExhibition: false,
  printEnabled: false,
  printPriceEuros: '',
  printEditionLimited: false,
  printEditionTotal: '',
  printOptions: null,
  printRecommendations: null,
})

export const populateFormData = (data: Artwork): ArtworkFormData => ({
  name: data.name || '',
  artworkType: data.artworkType || 'image',
  title: data.title || '',
  author: data.author || '',
  year: data.year || '',
  technique: data.technique || '',
  dimensions: data.dimensions || '',
  description: data.description || '',
  textContent: stripHtml(data.textContent || ''),
  featured: data.featured ?? false,
  hiddenFromExhibition: data.hiddenFromExhibition ?? false,
  printEnabled: data.printEnabled ?? false,
  printPriceEuros:
    typeof data.printPriceCents === 'number' ? (data.printPriceCents / 100).toString() : '',
  printEditionLimited: data.printEditionLimited ?? false,
  printEditionTotal:
    typeof data.printEditionTotal === 'number' ? String(data.printEditionTotal) : '',
  printOptions: data.printOptions ?? null,
  printRecommendations: data.printRecommendations ?? null,
})

type ArtworkEditFormProps = {
  formData: ArtworkFormData
  imageUrl: string | null
  imageDpi?: number | null
  originalWidth?: number | null
  originalHeight?: number | null
  originalImageUrl?: string | null
  originalFormat?: string | null
  originalSizeBytes?: number | null
  soundUrl?: string | null
  videoUrl?: string | null
  uploading: boolean
  loadingText?: string
  saving: boolean
  error: string
  onFormChange: (field: string, value: string | boolean) => void
  /** Replace the whole printOptions object. Called as the artist (un)checks boxes. */
  onPrintOptionsChange?: (next: PrintRestrictions | null) => void
  /** Replace the whole printRecommendations object. Paper IDs only for now. */
  onPrintRecommendationsChange?: (next: PrintRecommendations | null) => void
  onImageUpload: (file: File, previewUrl?: string) => Promise<void>
  onImageRemove: () => void | Promise<void>
  onSoundUpload?: (file: File) => Promise<void>
  onSoundRemove?: () => void | Promise<void>
  onVideoUpload?: (file: File) => Promise<void>
  onVideoRemove?: () => void | Promise<void>
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

const ALLOWED_SOUND_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
]
const MAX_SOUND_SIZE = 3 * 1024 * 1024 // 3MB

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm']
const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50MB

// TPS accepted image formats. Used to gate the print-sales toggle for
// legacy uploads (e.g. WebP) where the file can't be sent to TPS.
const TPS_ACCEPTED_FORMATS: readonly string[] = ['JPEG', 'PNG', 'TIFF']

function isImageFormatPrintable(format: string | undefined | null): boolean {
  if (!format) return true
  const upper = format.toUpperCase()
  // Skip the placeholder fallback used when we don't have a real
  // format on hand (e.g. legacy artworks pre-format-tracking).
  if (upper === 'IMAGE') return true
  return TPS_ACCEPTED_FORMATS.includes(upper)
}

function toggleTpsRestrictionId(
  current: PrintRestrictions | null,
  dimensionId: string,
  id: string,
  all: readonly string[],
): PrintRestrictions | null {
  const currentList = current?.allowed?.[dimensionId]
  const effective = currentList && currentList.length > 0 ? [...currentList] : [...all]
  const idx = effective.indexOf(id)
  const next = idx === -1 ? [...effective, id] : effective.filter((x) => x !== id)

  // All checked or zero checked → drop this dimension's allow-list.
  const reachesAll = next.length === all.length
  const isEmpty = next.length === 0
  const shouldClear = reachesAll || isEmpty

  const baseAllowed: Record<string, string[]> = { ...(current?.allowed ?? {}) }
  if (shouldClear) delete baseAllowed[dimensionId]
  else baseAllowed[dimensionId] = next

  return Object.keys(baseAllowed).length === 0 ? null : { allowed: baseAllowed }
}

function isTpsDimensionChecked(
  restrictions: PrintRestrictions | null,
  dimensionId: string,
  id: string,
): boolean {
  const list = restrictions?.allowed?.[dimensionId]
  if (!list || list.length === 0) return true
  return list.includes(id)
}

type TpsRestrictionGroupProps = {
  title: string
  all: Array<{ id: string; label: string }>
  allIds: readonly string[]
  dimensionId: string
  restrictions: PrintRestrictions | null
  onChange?: (next: PrintRestrictions | null) => void
}

const TpsRestrictionGroup = ({
  title,
  all,
  allIds,
  dimensionId,
  restrictions,
  onChange,
}: TpsRestrictionGroupProps) => {
  const handleToggle = (id: string) => {
    if (!onChange) return
    onChange(toggleTpsRestrictionId(restrictions, dimensionId, id, allIds))
  }
  return (
    <div className={styles.printRestrictionGroup}>
      <h4 className={styles.printRestrictionGroupTitle}>{title}</h4>
      <div className={styles.printRestrictionChoices}>
        {all.map((item) => (
          <Checkbox
            key={item.id}
            checked={isTpsDimensionChecked(restrictions, dimensionId, item.id)}
            onChange={() => handleToggle(item.id)}
            label={item.label}
          />
        ))}
      </div>
    </div>
  )
}

// Paper recommendation toggles. Same opt-in model as restrictions, but
// the default state is "not recommended" — no implicit all-recommended
// universe. Storing `null` when the artist clears every paper keeps the
// wizard's empty-state logic ("no checkmarks, no legend") simple.
function togglePaperRecommendation(
  current: PrintRecommendations | null,
  paperId: string,
): PrintRecommendations | null {
  const list = current?.paper ?? []
  const idx = list.indexOf(paperId)
  const next = idx === -1 ? [...list, paperId] : list.filter((x) => x !== paperId)
  if (next.length === 0) return null
  return { paper: next }
}

function isPaperRecommended(
  recommendations: PrintRecommendations | null,
  paperId: string,
): boolean {
  return recommendations?.paper?.includes(paperId) ?? false
}

type PaperRecommendationGroupProps = {
  papers: Array<{ id: string; label: string }>
  recommendations: PrintRecommendations | null
  onChange?: (next: PrintRecommendations | null) => void
}

const PaperRecommendationGroup = ({
  papers,
  recommendations,
  onChange,
}: PaperRecommendationGroupProps) => {
  const handleToggle = (id: string) => {
    if (!onChange) return
    onChange(togglePaperRecommendation(recommendations, id))
  }
  if (papers.length === 0) {
    return (
      <p className={styles.printRestrictionsIntro}>
        You&apos;ve vetoed every paper in your printing restrictions — nothing to recommend.
      </p>
    )
  }
  return (
    <div className={styles.printRestrictionGroup}>
      <h4 className={styles.printRestrictionGroupTitle}>Papers</h4>
      <div className={styles.printRestrictionChoices}>
        {papers.map((item) => (
          <Checkbox
            key={item.id}
            checked={isPaperRecommended(recommendations, item.id)}
            onChange={() => handleToggle(item.id)}
            label={item.label}
          />
        ))}
      </div>
    </div>
  )
}

export const ArtworkEditForm = ({
  formData,
  imageUrl,
  imageDpi,
  originalWidth,
  originalHeight,
  originalFormat,
  originalSizeBytes,
  soundUrl,
  videoUrl,
  uploading,
  loadingText = 'Uploading...',
  saving,
  error,
  onFormChange,
  onPrintOptionsChange,
  onPrintRecommendationsChange,
  onImageUpload,
  onImageRemove,
  onSoundUpload,
  onSoundRemove,
  onVideoUpload,
  onVideoRemove,
  onSubmit,
  onCancel,
}: ArtworkEditFormProps) => {
  const soundInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingSound, setIsDraggingSound] = useState(false)
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)
  const [soundSizeError, setSoundSizeError] = useState<string | null>(null)
  const [videoSizeError, setVideoSizeError] = useState<string | null>(null)
  // If server has original file info, use that directly instead of reading from CDN image
  const serverMeta = useMemo<ImageMeta | null>(() => {
    if (originalWidth && originalHeight) {
      return {
        width: originalWidth,
        height: originalHeight,
        format: originalFormat ?? 'Image',
        sizeBytes: originalSizeBytes ?? 0,
        dpi: imageDpi ?? undefined,
      }
    }
    return null
  }, [originalWidth, originalHeight, originalFormat, originalSizeBytes, imageDpi])

  const [clientMeta, setClientMeta] = useState<ImageMeta | null>(null)
  const [showPrintInfoModal, setShowPrintInfoModal] = useState(false)

  // Server meta takes priority over client-detected meta
  const imageMeta = serverMeta ?? clientMeta

  // TPS supports custom sizes (aspect-locked), so eligibility is
  // sample-based: walk a series of long-edge values, find any that
  // hit 300 DPI. If at least one passes, the artist can sell prints.
  const printMinSize = getPrintMinSize(imageMeta)
  const printEligible = printMinSize !== null
  const printMaxSize = printEligible ? getPrintMaxSize(imageMeta) : null

  // Format check: TPS accepts JPG/PNG/TIFF. Disables the
  // "Enable print sales" toggle for legacy uploads (e.g. WebP).
  const printableFormat = isImageFormatPrintable(imageMeta?.format)

  const handleImageMetaChange = useCallback((meta: ImageMeta | null) => {
    if (meta && meta.width > 0) {
      setClientMeta(meta)
    } else if (meta === null) {
      setClientMeta(null)
    }
  }, [])

  const handleSoundFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && onSoundUpload) {
        if (file.size > MAX_SOUND_SIZE) {
          setSoundSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 3MB.`,
          )
          if (soundInputRef.current) soundInputRef.current.value = ''
          return
        }
        setSoundSizeError(null)
        await onSoundUpload(file)
      }
      if (soundInputRef.current) soundInputRef.current.value = ''
    },
    [onSoundUpload],
  )

  const handleSoundDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingSound(false)
      const file = e.dataTransfer.files?.[0]
      if (file && ALLOWED_SOUND_TYPES.includes(file.type) && onSoundUpload) {
        if (file.size > MAX_SOUND_SIZE) {
          setSoundSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 3MB.`,
          )
          return
        }
        setSoundSizeError(null)
        await onSoundUpload(file)
      }
    },
    [onSoundUpload],
  )

  const handleVideoFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && onVideoUpload) {
        if (file.size > MAX_VIDEO_SIZE) {
          setVideoSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 50MB.`,
          )
          if (videoInputRef.current) videoInputRef.current.value = ''
          return
        }
        setVideoSizeError(null)
        await onVideoUpload(file)
      }
      if (videoInputRef.current) videoInputRef.current.value = ''
    },
    [onVideoUpload],
  )

  const handleVideoDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingVideo(false)
      const file = e.dataTransfer.files?.[0]
      if (file && ALLOWED_VIDEO_TYPES.includes(file.type) && onVideoUpload) {
        if (file.size > MAX_VIDEO_SIZE) {
          setVideoSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 50MB.`,
          )
          return
        }
        setVideoSizeError(null)
        await onVideoUpload(file)
      }
    },
    [onVideoUpload],
  )

  return (
    <>
      {/* Page Title — type-specific so the artist immediately sees which
          surface they're on (Image / Text / Video / Sound). */}
      <h1 className={dashboardStyles.pageTitle}>
        {formData.artworkType === 'image'
          ? 'Edit Image'
          : formData.artworkType === 'text'
            ? 'Edit Text'
            : formData.artworkType === 'video'
              ? 'Edit Video'
              : formData.artworkType === 'sound'
                ? 'Edit Sound'
                : 'Edit Artwork'}
      </h1>

      {/* Print Sales — pinned to the top for image artworks so artists see
          the sell-as-print decision before scrolling into metadata.
          The enable toggle gates everything else: provider, price and
          restrictions only render once the artist opts in. */}
      {formData.artworkType === 'image' && (
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Print Sales</h3>
          <p className={dashboardStyles.sectionDescription}>
            Let buyers order a physical print of this artwork. We&apos;ll show a &quot;Buy
            Printable&quot; button next to &quot;Inquire&quot; on the public page.
          </p>

          <Checkbox
            checked={formData.printEnabled}
            onChange={(e) => {
              if ((printEligible && printableFormat) || !e.target.checked) {
                onFormChange('printEnabled', e.target.checked)
              }
            }}
            label="Enable this artwork for print sales"
            disabled={!printEligible || !printableFormat}
          />
          {!printEligible && !imageMeta && (
            <p className={styles.printDisabledHint}>
              Upload your artwork image to check print eligibility. Prints need at least{' '}
              {MIN_PRINT_WIDTH} × {MIN_PRINT_HEIGHT} px (about {MIN_DPI} DPI on the smallest
              sellable print).
            </p>
          )}
          {!printEligible && imageMeta && (
            <div className={styles.printStatusNotReady}>
              <Icon name="alert-circle" size={16} />
              <div>
                <strong>This image isn&apos;t high enough resolution for print sales.</strong>
                <p style={{ margin: 'var(--space-2) 0 0' }}>
                  Your file:{' '}
                  <strong>
                    {imageMeta.width} × {imageMeta.height} px
                  </strong>
                  <br />
                  Required:{' '}
                  <strong>
                    at least {MIN_PRINT_WIDTH} × {MIN_PRINT_HEIGHT} px
                  </strong>
                </p>
                <p style={{ margin: 'var(--space-2) 0 0' }}>
                  Re-upload a higher-resolution version to enable prints. We need {MIN_DPI} DPI on
                  the smallest sellable print (20 cm on the long edge).
                </p>
              </div>
            </div>
          )}
          {printEligible && !printableFormat && imageMeta && (
            <p className={styles.printDisabledHint}>
              The current image format ({imageMeta.format}) can&apos;t be printed. Re-upload as
              JPEG, PNG or TIFF to enable print sales.
            </p>
          )}

          {formData.printEnabled && (
            <>
              <div
                className={dashboardStyles.field}
                style={{ maxWidth: 240, marginTop: 'var(--space-4)' }}
              >
                <label htmlFor="printPriceEuros">Your price per print (&euro;)</label>
                <Input
                  id="printPriceEuros"
                  type="text"
                  inputMode="decimal"
                  size="medium"
                  value={formData.printPriceEuros}
                  onChange={(e) =>
                    onFormChange(
                      'printPriceEuros',
                      // Accept both period and comma as decimal separators
                      // (Spanish/EU users) but normalise to period — the
                      // app's display convention is always `1234.56`.
                      e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''),
                    )
                  }
                  placeholder="100"
                />
              </div>
              <p className={styles.printDisabledHint} style={{ marginTop: 'var(--space-2)' }}>
                This is the amount you earn per print sold. Production, shipping, gallery fee and
                VAT are added separately at checkout.
              </p>

              <div style={{ marginTop: 'var(--space-4)' }}>
                <Checkbox
                  checked={formData.printEditionLimited}
                  onChange={(e) => onFormChange('printEditionLimited', e.target.checked)}
                  label="This artwork is a limited edition"
                />
                <div
                  className={dashboardStyles.field}
                  style={{ maxWidth: 240, marginTop: 'var(--space-2)' }}
                >
                  <label htmlFor="printEditionTotal">Total prints in the series</label>
                  <Input
                    id="printEditionTotal"
                    type="text"
                    inputMode="numeric"
                    size="medium"
                    value={formData.printEditionTotal}
                    disabled={!formData.printEditionLimited}
                    onChange={(e) =>
                      onFormChange(
                        'printEditionTotal',
                        // Integer only.
                        e.target.value.replace(/[^0-9]/g, ''),
                      )
                    }
                    placeholder="50"
                  />
                  <p className={styles.printDisabledHint} style={{ marginTop: 'var(--space-2)' }}>
                    When enabled, buyers see &quot;limited edition of{' '}
                    {formData.printEditionTotal || 'N'}&quot; on the print page.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Video File Upload Section - only for video type */}
      {formData.artworkType === 'video' && (
        <div className={`${dashboardStyles.section} ${styles.imageSectionHalf}`}>
          <h3 className={dashboardStyles.sectionTitle}>Video File</h3>
          <p className={dashboardStyles.sectionDescription}>
            Upload the video file. This will be played in exhibitions.
          </p>

          <FileInput
            ref={videoInputRef}
            id="artwork-video-file"
            accept="video/mp4,video/webm"
            onChange={handleVideoFileSelect}
            className={styles.hiddenInput}
          />

          {videoUrl ? (
            <div className={styles.soundPreview}>
              <div className={styles.soundInfo}>
                <Icon name="video" size={24} color="#333" />
                <video
                  controls
                  controlsList="nodownload"
                  src={videoUrl}
                  className={styles.videoPlayer}
                >
                  Your browser does not support the video element.
                </video>
              </div>
              {onVideoRemove && (
                <Button
                  font="dashboard"
                  variant="secondary"
                  label="Remove"
                  onClick={() => onVideoRemove()}
                  type="button"
                />
              )}
            </div>
          ) : (
            <div
              className={`${styles.soundDropzone} ${isDraggingVideo ? styles.dragging : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingVideo(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingVideo(false)
              }}
              onDrop={handleVideoDrop}
              onClick={() => videoInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && videoInputRef.current?.click()}
            >
              {uploading ? (
                <span className={styles.uploadingText}>{loadingText}</span>
              ) : (
                <>
                  <Button
                    font="dashboard"
                    variant="primary"
                    label="Select a Video File"
                    onClick={(e) => {
                      e.stopPropagation()
                      videoInputRef.current?.click()
                    }}
                    type="button"
                  />
                  <span className={styles.dropText}>or drag and drop files</span>
                </>
              )}
            </div>
          )}

          {videoSizeError && <div className={styles.sizeError}>{videoSizeError}</div>}
          <span className={dashboardStyles.hint}>
            Accepted: MP4, WebM (max 50MB). Videos are automatically optimized for the gallery.
          </span>
        </div>
      )}

      {/* Image Upload Section - for image and video types (poster for video) */}
      {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
        <div
          className={`${dashboardStyles.section} ${formData.artworkType === 'image' ? styles.imageSection : styles.imageSectionHalf}`}
        >
          <h3 className={dashboardStyles.sectionTitle}>
            {formData.artworkType === 'video' ? 'Video Poster' : 'Artwork Image'}
          </h3>
          <p className={dashboardStyles.sectionDescription}>
            {formData.artworkType === 'video'
              ? 'Optional. Upload a poster image for this video. If not provided, the first frame of the video will be used.'
              : 'Upload the artwork image. This will be displayed in exhibitions and on your profile.'}
          </p>

          <div className={styles.imageRow}>
            <div className={styles.imageUploaderCol}>
              <ImageUploader
                imageUrl={imageUrl}
                onUpload={onImageUpload}
                onRemove={onImageRemove}
                onMetaChange={handleImageMetaChange}
                displayMeta={serverMeta}
                uploading={uploading}
                loadingText={loadingText}
                aspectRatio="1 / 1"
                objectFit="contain"
                maxSizeBytes={MAX_ARTWORK_UPLOAD_SIZE}
                minWidth={MIN_ARTWORK_IMAGE_WIDTH}
                minHeight={MIN_ARTWORK_IMAGE_HEIGHT}
              />
            </div>

            {/* Print requirements info — only when print sales is enabled.
                The DPI/eligibility detail is irrelevant if the artist
                isn't selling prints, so we keep it gated behind the
                Print Sales toggle to avoid noise. */}
            {formData.artworkType === 'image' && formData.printEnabled && (
              <div className={styles.printInfoCol}>
                <div className={styles.printInfoCard}>
                  <h4 className={styles.printInfoTitle}>
                    <Icon name="printer" size={16} />
                    Sell as print
                  </h4>
                  <p className={styles.printInfoText}>
                    To enable print sales, your image needs to be high resolution (at least{' '}
                    {MIN_PRINT_WIDTH} × {MIN_PRINT_HEIGHT} px). The larger the image, the more print
                    sizes will be available to buyers.
                  </p>

                  {imageUrl && imageMeta ? (
                    printMinSize ? (
                      <>
                        <p
                          className={styles.printInfoText}
                          style={{ marginBottom: 'var(--space-1)' }}
                        >
                          <strong>Print size range for this file:</strong>
                        </p>
                        <p
                          className={styles.printInfoTextMuted}
                          style={{ marginTop: 0, marginBottom: 'var(--space-2)' }}
                        >
                          This range is the maximum we can print sharply for{' '}
                          <strong>this specific artwork</strong> — the higher the resolution of the
                          file you uploaded, the bigger the max. Buyers pick any custom size in
                          this range; the other side auto-locks to your artwork&apos;s aspect
                          ratio.
                        </p>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            margin: 0,
                            fontSize: 'var(--text-xs)',
                          }}
                        >
                          <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}>
                              <th
                                style={{
                                  padding: 'var(--space-1) var(--space-2) var(--space-1) 0',
                                  fontWeight: 500,
                                }}
                              >
                                Smallest
                              </th>
                              <th style={{ padding: 'var(--space-1) 0', fontWeight: 500 }}>
                                Your max
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderTop: '1px solid var(--color-border-default)' }}>
                              <td
                                style={{
                                  padding: 'var(--space-1) var(--space-2) var(--space-1) 0',
                                }}
                              >
                                <strong>
                                  {formatPrintSize(printMinSize.heightCm, printMinSize.widthCm)}
                                </strong>
                              </td>
                              <td style={{ padding: 'var(--space-1) 0' }}>
                                {printMaxSize ? (
                                  <strong>
                                    {formatPrintSize(printMaxSize.heightCm, printMaxSize.widthCm)}
                                  </strong>
                                ) : (
                                  <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </>
                    ) : (
                      <div className={styles.printStatusNotReady}>
                        <Icon name="alert-circle" size={16} />
                        <span>
                          This image is {imageMeta.width} × {imageMeta.height} px — below the{' '}
                          {MIN_DPI} DPI threshold for any sellable size. Upload a higher resolution
                          version to enable print sales.
                        </span>
                      </div>
                    )
                  ) : (
                    <p className={styles.printInfoTextMuted}>
                      Upload an image to check print eligibility.
                    </p>
                  )}

                  <div style={{ marginTop: 'var(--space-3)' }}>
                    <Button
                      font="dashboard"
                      variant="primary"
                      label="More info on print sizes"
                      onClick={() => setShowPrintInfoModal(true)}
                      type="button"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <span className={dashboardStyles.hint}>
            Accepted: JPEG, PNG, TIFF. Minimum resolution: {MIN_ARTWORK_IMAGE_WIDTH} ×{' '}
            {MIN_ARTWORK_IMAGE_HEIGHT} px. Images are automatically optimized for the web.
          </span>
        </div>
      )}

      {/* Per-artwork printing restrictions. Stored in canonical
          PrintRestrictions shape (`{ allowed: { dimId: ids[] } }`). */}
      {formData.artworkType === 'image' && formData.printEnabled && (
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Printing restrictions</h3>
          <p className={dashboardStyles.sectionDescription}>
            Advanced — you don&apos;t need to touch this unless you have very specific reasons not
            to offer a particular paper, frame type or passepartout for this artwork.
          </p>

          <details className={styles.printRestrictions}>
            <summary className={styles.printRestrictionsSummary}>Show options</summary>

            <p className={styles.printRestrictionsIntro}>
              We offer many printing options — to keep this simple we only let you veto the three
              that matter most for editorial control: papers, frame types and the passepartout.
              Everything that stays checked remains available to buyers.
            </p>

            <TpsRestrictionGroup
              title="Papers"
              all={TPS_PAPERS.map((p) => ({ id: p.id, label: p.label }))}
              dimensionId="paper"
              restrictions={formData.printOptions ?? null}
              onChange={onPrintOptionsChange}
              allIds={TPS_PAPERS.map((p) => p.id)}
            />
            <TpsRestrictionGroup
              title="Frame types"
              all={TPS_FRAME_TYPES.map((f) => ({ id: f.id, label: f.label }))}
              dimensionId="frameType"
              restrictions={formData.printOptions ?? null}
              onChange={onPrintOptionsChange}
              allIds={TPS_FRAME_TYPES.map((f) => f.id)}
            />
            <TpsRestrictionGroup
              title="Mount (Passepartout)"
              all={TPS_WINDOW_MOUNTS.map((w) => ({ id: w.id, label: w.label }))}
              dimensionId="windowMount"
              restrictions={formData.printOptions ?? null}
              onChange={onPrintOptionsChange}
              allIds={TPS_WINDOW_MOUNTS.map((w) => w.id)}
            />
          </details>
        </div>
      )}

      {/* Per-artwork paper recommendations. Soft hint — does not filter,
          just surfaces a check-circle in the buyer's paper picker.
          Vetoed papers are hidden so the artist can't recommend a paper
          buyers can't pick. */}
      {formData.artworkType === 'image' && formData.printEnabled && (
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Printing recommendations</h3>
          <p className={dashboardStyles.sectionDescription}>
            Advanced — pick the specific paper types you&apos;d recommend for this artwork. Buyers
            see a checkmark next to your picks in the print wizard; every paper stays available
            either way.
          </p>

          <details className={styles.printRestrictions}>
            <summary className={styles.printRestrictionsSummary}>Show options</summary>

            <p className={styles.printRestrictionsIntro}>
              Recommendations are a soft hint, not a filter. Anything you check here gets a
              checkmark in the buyer&apos;s paper picker plus a legend explaining it&apos;s your
              recommendation for best results.
            </p>

            <PaperRecommendationGroup
              papers={TPS_PAPERS.filter((p) =>
                isTpsDimensionChecked(formData.printOptions ?? null, 'paper', p.id),
              ).map((p) => ({ id: p.id, label: p.label }))}
              recommendations={formData.printRecommendations ?? null}
              onChange={onPrintRecommendationsChange}
            />
          </details>
        </div>
      )}

      {/* Sound Upload Section - only for sound type */}
      {formData.artworkType === 'sound' && (
        <div className={`${dashboardStyles.section} ${styles.imageSectionHalf}`}>
          <h3 className={dashboardStyles.sectionTitle}>Audio File</h3>
          <p className={dashboardStyles.sectionDescription}>
            Upload an audio file. This sound will be playable in exhibitions.
          </p>

          <FileInput
            ref={soundInputRef}
            id="artwork-sound-file"
            accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/wav,audio/x-wav,audio/aac,audio/flac"
            onChange={handleSoundFileSelect}
            className={styles.hiddenInput}
          />

          {soundUrl ? (
            <div className={styles.soundPreview}>
              <div className={styles.soundInfo}>
                <Icon name="volume-2" size={24} color="#333" />
                <audio controls src={soundUrl} className={styles.audioPlayer}>
                  Your browser does not support the audio element.
                </audio>
              </div>
              {onSoundRemove && (
                <Button
                  font="dashboard"
                  variant="secondary"
                  label="Remove"
                  onClick={() => onSoundRemove()}
                  type="button"
                />
              )}
            </div>
          ) : (
            <div
              className={`${styles.soundDropzone} ${isDraggingSound ? styles.dragging : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingSound(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingSound(false)
              }}
              onDrop={handleSoundDrop}
              onClick={() => soundInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && soundInputRef.current?.click()}
            >
              {uploading ? (
                <span className={styles.uploadingText}>{loadingText}</span>
              ) : (
                <>
                  <Button
                    font="dashboard"
                    variant="primary"
                    label="Select an Audio File"
                    onClick={(e) => {
                      e.stopPropagation()
                      soundInputRef.current?.click()
                    }}
                    type="button"
                  />
                  <span className={styles.dropText}>or drag and drop files</span>
                </>
              )}
            </div>
          )}

          {soundSizeError && <div className={styles.sizeError}>{soundSizeError}</div>}
          <span className={dashboardStyles.hint}>
            Accepted: MP3, M4A, OGG, WebM, WAV, AAC, FLAC (max 3MB).
          </span>
        </div>
      )}

      <form onSubmit={onSubmit}>
        {/* Title Section */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Title</h3>
          <p className={dashboardStyles.sectionDescription}>The display title for your artwork.</p>
          <Input
            id="title"
            type="text"
            size="medium"
            value={formData.title}
            onChange={(e) => onFormChange('title', e.target.value)}
            required
          />
          <span className={dashboardStyles.hint}>
            This will be shown in exhibitions and on your profile.
          </span>
        </div>

        {/* Author */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Author</h3>
            <Input
              id="author"
              type="text"
              size="medium"
              value={formData.author}
              onChange={(e) => onFormChange('author', e.target.value)}
            />
          </div>
        )}

        {/* Year */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Year</h3>
            <Input
              id="year"
              type="text"
              size="medium"
              value={formData.year}
              onChange={(e) => onFormChange('year', e.target.value)}
            />
          </div>
        )}

        {/* Technique / Medium */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Technique / Medium</h3>
            <RichTextEditor
              content={formData.technique}
              onChange={(content) => onFormChange('technique', content)}
              placeholder="e.g. Oil on canvas, mixed media..."
            />
          </div>
        )}

        {/* Dimensions */}
        {formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Dimensions</h3>
            <p className={dashboardStyles.sectionDescription}>
              A reference dimension shown on the public artwork page — most relevant for unique
              physical works (paintings, drawings, sculptures) where the size is fixed. For
              photography or editions sold as prints, list the original capture size; the actual
              print sizes are picked by the buyer in the print wizard.
            </p>
            <Input
              id="dimensions"
              type="text"
              size="medium"
              value={formData.dimensions}
              onChange={(e) => onFormChange('dimensions', e.target.value)}
              placeholder="e.g. 40 × 30 cm"
            />
            <span className={dashboardStyles.hint}>
              Follow gallery convention: height × width (× depth for 3D works).
            </span>
          </div>
        )}

        {/* Text Content - for text artworks (plain text only for 3D) */}
        {formData.artworkType === 'text' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Text Content</h3>
            <p className={dashboardStyles.sectionDescription}>
              Plain text content that will be displayed on the 3D stencil.
            </p>
            <textarea
              value={formData.textContent}
              onChange={(e) => onFormChange('textContent', e.target.value)}
              placeholder="Enter the text to display..."
              rows={8}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'inherit',
                fontSize: 'var(--text-sm)',
                lineHeight: '1.6',
                resize: 'vertical',
              }}
            />
            <span className={dashboardStyles.hint}>
              Text styling (font, weight, size) is limited in 3D and can be adjusted in the wall
              panel.
            </span>
          </div>
        )}

        {/* Description - for image artworks (supports rich text) */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Description</h3>
            <RichTextEditor
              content={formData.description}
              onChange={(content) => onFormChange('description', content)}
              placeholder="About this artwork..."
            />
          </div>
        )}

        {/* Featured Checkbox */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Featured Artwork</h3>
            <p className={dashboardStyles.sectionDescription}>
              Highlight this artwork on your public artist profile.
            </p>
            <Checkbox
              checked={formData.featured}
              onChange={(e) => onFormChange('featured', e.target.checked)}
              label="Feature on artist profile"
            />
            <span className={dashboardStyles.hint}>
              Featured artworks appear prominently in your profile&apos;s artwork grid.
            </span>
          </div>
        )}

        <ErrorText>{error}</ErrorText>

        <div className={dashboardStyles.actions}>
          <Button
            font="dashboard"
            variant="primary"
            label={saving ? 'Saving...' : 'Save'}
            type="submit"
          />
          <Button
            font="dashboard"
            variant="secondary"
            label="Cancel"
            onClick={onCancel}
            type="button"
          />
        </div>
      </form>

      {/* Print sizes info modal */}
      {showPrintInfoModal && (
        <Modal onClose={() => setShowPrintInfoModal(false)}>
          <div className={styles.printModal}>
            <Text as="h3" font="dashboard" size="lg" weight="medium">
              Print Size Requirements
            </Text>
            <p className={styles.printModalDescription}>
              Prints are sold at custom sizes, aspect-locked to your file. Buyers pick any width or
              height within your file&apos;s allowed range, and the other side auto-locks to your
              artwork&apos;s proportions. Prints ship at {MIN_DPI} DPI or higher.
            </p>

            {imageMeta && printMinSize && (
              <>
                <h4
                  style={{
                    margin: '0 0 var(--space-2)',
                    fontFamily: 'var(--font-dashboard), var(--font-dashboard-fallback)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Your file
                </h4>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '0 0 var(--space-4)',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    columnGap: 'var(--space-3)',
                    rowGap: 'var(--space-1)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <li style={{ color: 'var(--color-text-secondary)' }}>Resolution:</li>
                  <li>
                    <strong>
                      {imageMeta.width} × {imageMeta.height} px
                    </strong>
                  </li>
                  <li style={{ color: 'var(--color-text-secondary)' }}>Smallest sellable:</li>
                  <li>
                    <strong>{formatPrintSize(printMinSize.heightCm, printMinSize.widthCm)}</strong>
                  </li>
                  <li style={{ color: 'var(--color-text-secondary)' }}>
                    Largest at {MIN_DPI} DPI:
                  </li>
                  <li>
                    {printMaxSize ? (
                      <strong>
                        {formatPrintSize(printMaxSize.heightCm, printMaxSize.widthCm)}
                      </strong>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                    )}
                  </li>
                </ul>
              </>
            )}
            <div
              style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}
            >
              <Button
                font="dashboard"
                variant="primary"
                label="Got it"
                onClick={() => setShowPrintInfoModal(false)}
                type="button"
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
