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
import { RadioGroup } from '@/components/ui/RadioGroup'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Text } from '@/components/ui/Typography'
import {
  MIN_DPI,
  TPS_FRAME_TYPES,
  TPS_PAPERS,
  TPS_WINDOW_MOUNTS,
  formatPrintSize,
  getPrintLongEdgeBounds,
  getPrintMaxSize,
  getPrintMinSize,
} from '@/lib/print-providers/printspace'
import type { PrintRecommendations, PrintRestrictions } from '@/lib/print-providers'
import type { LimitedVariantDraft } from '@/lib/editions/types'
import { LimitedVariantsEditor } from './LimitedVariantsEditor'
import { ArtworkMediaManager } from './ArtworkMediaManager'
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
  editionType?: 'open' | 'limited'
  editionLocked?: boolean
  limitedVariants?: LimitedVariantDraft[]
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
  /** 'open' = fully configurable prints (current flow). 'limited' = numbered
   *  edition sold via pre-defined variants only. */
  editionType: 'open' | 'limited'
  /** True once the artist has clicked "Ready to Sell" — the edition config
   *  is frozen and only an admin can unblock it. */
  editionLocked: boolean
  /** Limited-edition variants (1 mandatory + up to 3 optional). Only used
   *  when `editionType === 'limited'`. */
  limitedVariants: LimitedVariantDraft[]
  /** @deprecated legacy flag, superseded by `editionType`. */
  printEditionLimited: boolean
  /** @deprecated legacy field, superseded by `limitedVariants`. */
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
  editionType: 'open',
  editionLocked: false,
  limitedVariants: [],
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
  editionType: data.editionType === 'limited' ? 'limited' : 'open',
  editionLocked: data.editionLocked ?? false,
  limitedVariants: (data.limitedVariants ?? []).map((v) => ({
    ...v,
    priceEuros: typeof v.priceCents === 'number' ? (v.priceCents / 100).toString() : '',
  })),
  printEditionLimited: data.printEditionLimited ?? false,
  printEditionTotal:
    typeof data.printEditionTotal === 'number' ? String(data.printEditionTotal) : '',
  printOptions: data.printOptions ?? null,
  printRecommendations: data.printRecommendations ?? null,
})

type ArtworkEditFormProps = {
  formData: ArtworkFormData
  /** Saved artwork id — enables variant templates ("Apply saved variant");
   *  absent on the create-new form. */
  artworkId?: string | null
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
  /** Switch between open and limited editions. */
  onEditionTypeChange?: (next: 'open' | 'limited') => void
  /** Replace the whole limited-variants array (dashboard editor). */
  onVariantsChange?: (next: LimitedVariantDraft[]) => void
  /** True when the current viewer is an admin / superAdmin — they can
   *  unblock individual limited variants; artists cannot. */
  isAdmin?: boolean
  /** True only for superAdmin — gates the open-edition "Unblock" control,
   *  which reopens a locked open artwork's print setup. */
  isSuperAdmin?: boolean
  /** "Ready to Sell" — lock the edition config (and publish variants). */
  onReadyToSell?: () => void
  /** Admin-only: unblock a locked artwork so its config is editable. */
  onUnblock?: () => void
  /** Admin-only: take a live limited variant off sale to edit it. */
  onUnblockVariant?: (variantId: string) => void
  /** Put an off-sale limited variant on sale ("Ready to Sell"). */
  onReadyToSellVariant?: (index: number) => void
  /** Delete a saved limited variant on the server, at once (confirmed in the
   *  editor). Unsaved rows never reach this. */
  onDeleteVariant?: (variantId: string) => Promise<{ ok: boolean; error?: string }>
  /** Save (or create) one variant on its own, without an artwork save. */
  onSaveVariant?: (
    variantId: string | null,
    values: LimitedVariantDraft,
  ) => Promise<{ ok: boolean; error?: string; variantId?: string }>
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
  artworkId = null,
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
  onEditionTypeChange,
  onVariantsChange,
  isAdmin = false,
  isSuperAdmin = false,
  onReadyToSell,
  onUnblock,
  onUnblockVariant,
  onReadyToSellVariant,
  onDeleteVariant,
  onSaveVariant,
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
  // Silent until the artist clicks the open-edition "Ready to Sell"; then the
  // price error shows and clears live once a valid price is entered.
  const [triedOpenReadyToSell, setTriedOpenReadyToSell] = useState(false)
  // Title is required (the form has noValidate, so we guard it in JS rather than
  // via the native bubble; the server only sanitizes, it doesn't reject empty).
  const [titleError, setTitleError] = useState<string>()

  const handleFormSubmit = (e: React.FormEvent) => {
    if (!formData.title.trim()) {
      e.preventDefault()
      setTitleError('Please enter a title.')
      return
    }
    setTitleError(undefined)
    onSubmit(e)
  }
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

  // A freshly picked file reports a real byte size; the CDN-image probe
  // reports 0. So when the artist has just chosen a replacement (before
  // saving), prefer that file's metadata — otherwise the "Original file"
  // line and the print check keep showing the stale saved-original until save.
  const pendingClientMeta = clientMeta && clientMeta.sizeBytes > 0 ? clientMeta : null

  // Priority: a pending pick > the saved original (server) > CDN-probed meta.
  const imageMeta = pendingClientMeta ?? serverMeta ?? clientMeta

  // Aspect ratio (width / height) + long-edge bounds for the limited-edition
  // variant size inputs — same source the buyer wizard uses, so variant
  // sizing behaves identically.
  const editionAspectRatio =
    imageMeta && imageMeta.width > 0 && imageMeta.height > 0
      ? imageMeta.width / imageMeta.height
      : 1
  const editionLongEdgeBounds = getPrintLongEdgeBounds(imageMeta)

  // TPS supports custom sizes (aspect-locked), so eligibility is
  // sample-based: walk a series of long-edge values, find any that
  // hit 300 DPI. If at least one passes, the artist can sell prints.
  const printMinSize = getPrintMinSize(imageMeta)
  const printEligible = printMinSize !== null
  const printMaxSize = printEligible ? getPrintMaxSize(imageMeta) : null

  // Format check: TPS accepts JPG/PNG/TIFF. Disables the
  // "Enable print sales" toggle for legacy uploads (e.g. WebP).
  const printableFormat = isImageFormatPrintable(imageMeta?.format)

  // Series-type lock. Open editions use the stored artwork-level flag (set by
  // the artwork "Ready to Sell", reversed by admin unblock). Limited editions
  // derive it: the open/limited radio freezes as soon as ANY variant is live
  // (published + blocked) and re-opens once every variant is unblocked.
  const hasLiveVariant = formData.limitedVariants.some(
    (v) => v.published === true && v.blocked !== false,
  )
  const seriesTypeLocked =
    formData.editionType === 'limited' ? hasLiveVariant : formData.editionLocked

  // Open-edition price is required to go live. Silent until the artist tries to
  // "Ready to Sell", then shows + clears live as they enter a valid price.
  const openPriceInvalid = !formData.printPriceEuros || !(Number(formData.printPriceEuros) > 0)
  const openPriceError = triedOpenReadyToSell && openPriceInvalid
  const handleOpenReadyToSell = () => {
    if (openPriceInvalid) {
      setTriedOpenReadyToSell(true)
      return
    }
    onReadyToSell?.()
  }

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
              {/* Artwork-level banner — reports ONLY the series-type lock,
                  which is the one thing that really is artwork-wide (the
                  open/limited radio below is disabled by it). Variant freezing
                  is per-variant and each live variant says so on its own card;
                  stating it here made fully-editable sibling variants look
                  frozen. The reason differs by type: an open edition locks when
                  the artwork itself is marked ready to sell, a limited one as
                  soon as ANY variant goes on sale. */}
              {seriesTypeLocked && (
                <div className={styles.editionLockedBanner} style={{ marginTop: 'var(--space-4)' }}>
                  <span className={styles.editionLockedBadge}>Locked</span>
                  <div>
                    <strong>The series type is locked.</strong>{' '}
                    {formData.editionType === 'limited'
                      ? 'At least one variant is ready to sell, so this artwork can no longer be switched to an open edition.'
                      : 'This artwork is marked ready to sell, so it can no longer be switched to a limited edition.'}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'var(--space-4)' }}>
                <label className={dashboardStyles.field}>Series type</label>
                <RadioGroup<'open' | 'limited'>
                  name="editionType"
                  options={[
                    { value: 'open', label: 'Open Edition' },
                    { value: 'limited', label: 'Limited Edition' },
                  ]}
                  value={formData.editionType}
                  disabled={seriesTypeLocked}
                  onChange={(v) => onEditionTypeChange?.(v)}
                />
                <p className={styles.printDisabledHint} style={{ marginTop: 'var(--space-2)' }}>
                  {formData.editionType === 'limited'
                    ? 'Numbered, print-only editions sold in pre-defined variants. Buyers pick a variant — no framing.'
                    : 'Fully configurable prints — buyers choose size, paper and framing. Unlimited.'}
                </p>
              </div>

              {/* Open editions: one artist price for the whole artwork. Limited
                  editions are priced per variant (in the editor below). */}
              {formData.editionType === 'open' && (
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
                      placeholder="Add your price here"
                      invalid={openPriceError}
                    />
                    {openPriceError && (
                      <ErrorText>Price is required and must be greater than 0.</ErrorText>
                    )}
                  </div>
                  <p className={styles.printDisabledHint} style={{ marginTop: 'var(--space-2)' }}>
                    This is the amount you earn per print sold. Production, shipping, gallery fee
                    and VAT are added separately at checkout.
                  </p>
                </>
              )}

              {formData.editionType === 'limited' && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <h4 className={dashboardStyles.sectionTitle}>Edition variants</h4>
                  <p className={styles.printDisabledHint}>
                    Define 1–4 variants. Each is its own numbered edition (e.g. “Small” 1/50) with
                    its own size and price. Sizes must be distinct. Once you start selling, the
                    edition is locked — only the price can still be changed (raise it as copies
                    sell).
                  </p>
                  <LimitedVariantsEditor
                    variants={formData.limitedVariants}
                    aspectRatio={editionAspectRatio}
                    longEdgeBounds={editionLongEdgeBounds}
                    onChange={(next) => onVariantsChange?.(next)}
                    artworkId={artworkId}
                    isAdmin={isAdmin}
                    onUnblockVariant={onUnblockVariant}
                    onReadyToSellVariant={onReadyToSellVariant}
                    onDeleteVariant={onDeleteVariant}
                    onSaveVariant={onSaveVariant}
                  />
                </div>
              )}

              {/* Limited editions publish per variant (the button lives inside
                  each variant card above). Open editions show their
                  "Ready to Sell" / "Unblock" control below the printing
                  options instead — see the open-edition go-live section. */}
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
                displayMeta={pendingClientMeta ?? serverMeta}
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

                  <div className={styles.printInfoBlock}>
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
                            <strong>this specific artwork</strong> — the higher the resolution of
                            the file you uploaded, the bigger the max. Buyers pick any custom size
                            in this range; the other side auto-locks to your artwork&apos;s aspect
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
                              <tr
                                style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}
                              >
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
                            {MIN_DPI} DPI threshold for any sellable size. Upload a higher
                            resolution version to enable print sales.
                          </span>
                        </div>
                      )
                    ) : (
                      <p className={styles.printInfoTextMuted}>
                        Upload an image to check print eligibility.
                      </p>
                    )}
                  </div>

                  <div>
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

      {/* Per-artwork printing restrictions. Open editions only — limited
          editions are constrained to their pre-defined variants. Stored in
          canonical PrintRestrictions shape (`{ allowed: { dimId: ids[] } }`). */}
      {formData.artworkType === 'image' &&
        formData.printEnabled &&
        formData.editionType === 'open' && (
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

      {/* Per-artwork paper recommendations. Open editions only. Soft hint —
          does not filter, just surfaces a check-circle in the buyer's paper
          picker. Vetoed papers are hidden so the artist can't recommend a
          paper buyers can't pick. */}
      {formData.artworkType === 'image' &&
        formData.printEnabled &&
        formData.editionType === 'open' && (
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

      {/* Open-edition go-live. Sits after the printing options because, for an
          open edition, those options stay editable for the life of the work —
          the ONLY thing "Ready to Sell" freezes is the series type (so an
          on-sale open edition can't be flipped to a limited one). A superAdmin
          can reopen it with "Unblock". */}
      {formData.artworkType === 'image' &&
        formData.printEnabled &&
        formData.editionType === 'open' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Ready to sell</h3>
            {!seriesTypeLocked ? (
              <>
                {onReadyToSell && (
                  <Button
                    type="button"
                    variant="primary"
                    label="Ready to Sell"
                    onClick={handleOpenReadyToSell}
                  />
                )}
                {openPriceError && (
                  <p className={styles.sizeError}>
                    Add your price above before putting this artwork on sale.
                  </p>
                )}
                <p className={styles.printDisabledHint} style={{ marginTop: 'var(--space-2)' }}>
                  Confirms this artwork is ready to sell. This locks the series type to “Open” — you
                  can’t switch it to a limited edition afterwards. Your price and printing options
                  stay editable.
                </p>
              </>
            ) : (
              <>
                {/* The series-type lock itself is stated once, in the banner
                    above. This section keeps only what is still actionable. */}
                <p className={styles.printDisabledHint} style={{ margin: 0 }}>
                  This open edition is on sale. Price and printing options remain editable.
                </p>
                {isSuperAdmin && onUnblock && (
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" label="Unblock" onClick={onUnblock} />
                  </div>
                )}
              </>
            )}
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

      <form onSubmit={handleFormSubmit} noValidate>
        {/* Title Section */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Title</h3>
          <p className={dashboardStyles.sectionDescription}>The display title for your artwork.</p>
          <Input
            id="title"
            type="text"
            size="medium"
            value={formData.title}
            onChange={(e) => {
              onFormChange('title', e.target.value)
              if (titleError && e.target.value.trim()) setTitleError(undefined)
            }}
            invalid={!!titleError}
            required
          />
          <ErrorText>{titleError}</ErrorText>
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

        {/* Gallery-curated sales imagery, admin only, and only once the
            artwork exists — an upload needs an id to attach to. */}
        {isAdmin && artworkId && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Supplementary media</h3>
            <p className={dashboardStyles.sectionDescription}>
              Close-ups, print mockups, the certificate, a short film &mdash; the evidence that a
              physical object exists.
            </p>
            <ArtworkMediaManager artworkId={artworkId} />
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
