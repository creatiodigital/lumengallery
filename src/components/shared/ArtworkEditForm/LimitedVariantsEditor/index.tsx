'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { SelectDropdown, type SelectOption } from '@/components/ui/SelectDropdown'
import { CustomSizeInputs } from '@/components/PrintWizard/CustomSizeInputs'

import { LIMITED_BORDER_MIN_CM, MAX_LIMITED_VARIANTS } from '@/lib/editions/validateVariant'
import type { LimitedVariantDraft } from '@/lib/editions/types'
import {
  computeSheetLayout,
  isFixedSheet,
  seedSheetForVariant,
  TPS_BORDER_REFERENCE_WIDTH_CM,
  TPS_BORDER_CAP_FRACTION,
} from '@/lib/editions/sheetLayout'
import { buildTpsRecipe, formatTpsRecipe } from '@/lib/editions/tpsRecipe'
import { TPS_PAPERS, TPS_SIZE_BOUNDS, MIN_SHORT_EDGE_CM } from '@/lib/print-providers/printspace'
import type { PrintLongEdgeBounds } from '@/lib/print-providers/printspace'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import styles from './LimitedVariantsEditor.module.scss'

const PAPER_OPTIONS: SelectOption[] = TPS_PAPERS.map((p) => ({ value: p.id, label: p.label }))

// Aspect-locked custom-size bounds for a variant — identical clamps to the
// buyer wizard (same TPS limits, aspect locked to the artwork).
const SIZE_CUSTOM = {
  minCm: TPS_SIZE_BOUNDS.minCm,
  maxCm: TPS_SIZE_BOUNDS.maxCm,
  stepCm: TPS_SIZE_BOUNDS.stepCm,
  aspectLocked: true as const,
}

/** A reusable variant spec from the artist's other artworks (see the
 *  /variant-templates API route) — applied as a prefilled draft. */
type VariantTemplate = {
  name: string
  paperId: string
  widthCm: number
  heightCm: number
  borderCm: number
  editionSize: number
  priceEuros: string
  sourceArtworkTitle: string
}

type Props = {
  variants: LimitedVariantDraft[]
  aspectRatio: number
  longEdgeBounds: PrintLongEdgeBounds | null
  onChange: (next: LimitedVariantDraft[]) => void
  /** Saved artwork id — enables "Apply saved variant" (templates come from
   *  the artist's other artworks; unsaved new artworks have none). */
  artworkId?: string | null
  /** Admin / superAdmin — only they can take a live variant off sale (Unblock). */
  isAdmin?: boolean
  /** Admin-only: take a live variant off sale to edit it (`blocked: false`). */
  onUnblockVariant?: (variantId: string) => void
  /** Put an off-sale variant on sale ("Ready to Sell"). Saves the form, then
   *  publishes a draft (materialises its edition) or resumes a previously
   *  unblocked variant. */
  onReadyToSellVariant?: (index: number) => void
}

/**
 * Flexible editor for a limited edition's variants: one mandatory variant
 * plus an "Add variant" CTA up to MAX_LIMITED_VARIANTS. No empty rows —
 * the artist only ever sees the variants they've added. Published variants
 * are locked (size + edition size frozen once numbers can sell).
 */
export const LimitedVariantsEditor = ({
  variants,
  aspectRatio,
  longEdgeBounds,
  onChange,
  artworkId = null,
  isAdmin = false,
  onUnblockVariant,
  onReadyToSellVariant,
}: Props) => {
  const keyFor = (v: LimitedVariantDraft, i: number) => v.id ?? `new-${i}`
  // A variant with nothing worth summarising still needs its fields visible.
  const isEmpty = (v: LimitedVariantDraft) => !v.name && !(v.widthCm > 0) && !v.priceEuros
  // Expanded state per row. Variants default collapsed to a compact summary
  // list; only empty/incomplete ones start open so required fields aren't hidden.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    variants.forEach((v, i) => {
      init[keyFor(v, i)] = isEmpty(v)
    })
    return init
  })
  const toggle = (k: string) => setExpanded((e) => ({ ...e, [k]: !e[k] }))

  // Presentation-only per-variant "fixed sheet" UI mode, keyed like
  // `expanded` above and seeded from isFixedSheet(variant) on mount.
  // Deliberately NOT re-derived from isFixedSheet(variant) on every render:
  // the sheet inputs coerce an empty/lone-"." field to a literal 0 via
  // `Number(...) || 0`, and isFixedSheet requires BOTH dimensions > 0 — so
  // a data-derived gate would flip the whole input block back to adaptive
  // mid-keystroke, disappearing the field the artist is typing into.
  // Persistence is unaffected: sheetWidthCm/sheetHeightCm nullability is
  // still the only thing that's saved or read by the server.
  const [sheetMode, setSheetModeMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    variants.forEach((v, i) => {
      init[keyFor(v, i)] = isFixedSheet(v)
    })
    return init
  })
  const isFixedFor = (v: LimitedVariantDraft, i: number) => sheetMode[keyFor(v, i)] ?? isFixedSheet(v)

  // Per-variant "tried to go live" flag. Validation is silent until the artist
  // clicks "Ready to Sell"; then required-field errors show for that card and
  // clear live as each field is fixed (the gallery form-validation convention).
  const [triedReadyToSell, setTriedReadyToSell] = useState<Record<string, boolean>>({})

  const update = (index: number, patch: Partial<LimitedVariantDraft>) => {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  const add = () => {
    if (variants.length >= MAX_LIMITED_VARIANTS) return
    // The new row is appended at the current length — open it for editing.
    setExpanded((e) => ({ ...e, [`new-${variants.length}`]: true }))
    onChange([
      ...variants,
      {
        name: '',
        paperId: TPS_PAPERS[0].id,
        widthCm: 0,
        heightCm: 0,
        borderCm: LIMITED_BORDER_MIN_CM,
        editionSize: 50,
        priceEuros: '',
      },
    ])
  }

  const remove = (index: number) => {
    onChange(variants.filter((_, i) => i !== index))
  }

  // "Apply saved variant" — reuse a spec from the artist's other artworks
  // (ratio-matched by the API) instead of retyping it per photo. Loaded
  // lazily on first click; applying appends a prefilled, still-editable
  // draft with the height re-derived from THIS artwork's exact ratio.
  const [templates, setTemplates] = useState<VariantTemplate[] | null>(null)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)

  const openTemplatePicker = async () => {
    setTemplatePickerOpen(true)
    if (templates !== null || templatesLoading || !artworkId) return
    setTemplatesLoading(true)
    setTemplatesError(null)
    try {
      const res = await fetch(`/api/artworks/${artworkId}/variant-templates`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load saved variants.')
      setTemplates(data.templates ?? [])
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : 'Failed to load saved variants.')
      setTemplates(null)
    } finally {
      setTemplatesLoading(false)
    }
  }

  const applyTemplate = (t: VariantTemplate) => {
    if (variants.length >= MAX_LIMITED_VARIANTS) return
    // Templates are offered only for EXACT aspect-ratio matches, so the spec
    // applies verbatim — identical print size, border and margins across the
    // whole series. No adaptation, ever.
    setExpanded((e) => ({ ...e, [`new-${variants.length}`]: true }))
    setTemplatePickerOpen(false)
    onChange([
      ...variants,
      {
        name: t.name,
        paperId: t.paperId,
        widthCm: t.widthCm,
        heightCm: t.heightCm,
        borderCm: t.borderCm,
        editionSize: t.editionSize,
        priceEuros: t.priceEuros,
      },
    ])
  }

  // Duplicate-size detection (TPS keys edition identity on print size).
  const sizeKey = (v: LimitedVariantDraft) => `${v.widthCm}x${v.heightCm}`
  const seen = new Map<string, number>()
  variants.forEach((v) => {
    if (v.widthCm > 0 && v.heightCm > 0) seen.set(sizeKey(v), (seen.get(sizeKey(v)) ?? 0) + 1)
  })
  const isDuplicate = (v: LimitedVariantDraft) =>
    v.widthCm > 0 && v.heightCm > 0 && (seen.get(sizeKey(v)) ?? 0) > 1

  // Required-field validation for going live — mirrors the server's
  // validateVariantInput so the artist never hits a blind 400. Aspect /
  // resolution bounds are already enforced by CustomSizeInputs, so here we only
  // guard presence + the simple numeric minimums.
  //
  // `isFixed` is the UI's own toggle state (see `sheetMode` above), NOT
  // isFixedSheet(v) — a mid-edit sheet field can be a transient 0, and
  // gating the error on the DATA rather than the artist's chosen mode would
  // hide the error exactly when the state is invalid (silence instead of a
  // guardrail). Keying off `isFixed` also matches the server's `hasAnySheet`
  // check (`!= null`, so a lingering 0 still counts as "a sheet is set"),
  // closing the blind-400 gap that used to exist here.
  const fieldErrorsOf = (v: LimitedVariantDraft, isFixed: boolean) => ({
    name: !v.name.trim() ? 'Name is required.' : null,
    size: !(v.widthCm > 0 && v.heightCm > 0) ? 'Set a print size.' : null,
    border: !(v.borderCm >= LIMITED_BORDER_MIN_CM)
      ? `Border must be at least ${LIMITED_BORDER_MIN_CM} cm.`
      : null,
    editionSize: !(Number.isInteger(v.editionSize) && v.editionSize >= 1)
      ? 'Enter how many copies (at least 1).'
      : null,
    price:
      !v.priceEuros || !(Number(v.priceEuros) > 0)
        ? 'Price is required and must be greater than 0.'
        : null,
    sheet: !isFixed
      ? null
      : !((v.sheetWidthCm ?? 0) > 0 && (v.sheetHeightCm ?? 0) > 0)
        ? 'Enter both sheet dimensions.'
        : !((v.sheetWidthCm as number) >= TPS_BORDER_REFERENCE_WIDTH_CM)
          ? `The sheet must be at least ${TPS_BORDER_REFERENCE_WIDTH_CM} cm wide.`
          : !(
                v.borderCm <=
                Math.min(v.sheetWidthCm as number, v.sheetHeightCm as number) *
                  TPS_BORDER_CAP_FRACTION +
                  0.001
              )
            ? 'The border is too large for this sheet — use at most a quarter of its shortest side.'
            : !(v.widthCm > 0 && v.heightCm > 0)
              ? 'That sheet and border leave no printable area.'
              : Math.min(v.widthCm, v.heightCm) < MIN_SHORT_EDGE_CM
                ? `The derived print would be ${v.heightCm.toFixed(1)} × ${v.widthCm.toFixed(1)} cm — its shortest side must be at least ${MIN_SHORT_EDGE_CM} cm. Use a bigger sheet or a smaller border.`
                : null,
  })
  const variantHasErrors = (v: LimitedVariantDraft, i: number) =>
    isDuplicate(v) || Object.values(fieldErrorsOf(v, isFixedFor(v, i))).some((e) => e !== null)

  // In fixed-sheet mode the image size is DERIVED, never typed. Recompute
  // it whenever the sheet or the minimum border changes so widthCm /
  // heightCm — which the server, pricing and the uniqueness key all read —
  // stay in lockstep with what will actually print.
  const withDerivedImage = (v: LimitedVariantDraft): Partial<LimitedVariantDraft> => {
    if (!isFixedSheet(v)) return {}
    const layout = computeSheetLayout({
      sheetWidthCm: v.sheetWidthCm as number,
      sheetHeightCm: v.sheetHeightCm as number,
      minBorderCm: v.borderCm,
      aspectRatio,
    })
    if (!layout) return {}
    return { widthCm: layout.imageWidthCm, heightCm: layout.imageHeightCm }
  }

  const setSheetMode = (index: number, fixed: boolean) => {
    const v = variants[index]
    setSheetModeMap((m) => ({ ...m, [keyFor(v, index)]: fixed }))
    if (!fixed) {
      update(index, { sheetWidthCm: null, sheetHeightCm: null })
      return
    }
    // Seed the sheet so the toggle always lands on a usable card — see
    // seedSheetForVariant for why a 0x0 seed is unsafe.
    const { sheetWidthCm, sheetHeightCm } = seedSheetForVariant({
      widthCm: v.widthCm,
      heightCm: v.heightCm,
      borderCm: v.borderCm,
      aspectRatio,
    })
    const next = { ...v, sheetWidthCm, sheetHeightCm }
    update(index, { sheetWidthCm, sheetHeightCm, ...withDerivedImage(next) })
  }

  const updateSheet = (index: number, patch: { sheetWidthCm?: number; sheetHeightCm?: number }) => {
    const next = { ...variants[index], ...patch }
    update(index, { ...patch, ...withDerivedImage(next) })
  }

  return (
    <div className={styles.editor}>
      {variants.map((variant, index) => {
        // Everything keys off one fact: a variant is LIVE (on sale) only while
        // it's published AND blocked. Live variants are frozen and can be taken
        // off sale (Unblock). Off-sale variants — a draft, or a published one an
        // admin has unblocked — are editable and show both "Ready to Sell" (put
        // on sale) and "Delete variant". This is purely per-variant; no variant
        // is special, and the other variants' state never affects this card.
        const isLive = variant.published === true && variant.blocked !== false
        const variantLocked = isLive
        // Take a live variant off sale to fix it — admin only.
        const showUnblock = isAdmin && isLive
        // Off-sale variants can be put on sale and deleted.
        const showReadyToSell = !isLive && !!onReadyToSellVariant
        const showDelete = !isLive
        const duplicateSize = isDuplicate(variant)
        const key = keyFor(variant, index)
        const isOpen = !!expanded[key]
        // The UI's own toggle state — see `sheetMode` above for why this,
        // not isFixedSheet(variant), drives everything this card renders.
        const isFixed = isFixedFor(variant, index)

        const fieldErrors = fieldErrorsOf(variant, isFixed)
        // Show a field's error only once the artist has tried to go live.
        const tried = !!triedReadyToSell[key]
        const errFor = (field: keyof typeof fieldErrors) => (tried ? fieldErrors[field] : null)

        // Putting one variant on sale saves the WHOLE form, so every variant
        // must be valid. Validate all on click; if any fail, reveal their errors
        // (expand the cards) and don't proceed — no blind 400.
        const handleReadyToSell = () => {
          const invalidKeys = variants
            .map((v, i) => [keyFor(v, i), variantHasErrors(v, i)] as const)
            .filter(([, bad]) => bad)
            .map(([k]) => k)
          if (invalidKeys.length > 0) {
            const flags = Object.fromEntries(invalidKeys.map((k) => [k, true]))
            setTriedReadyToSell((t) => ({ ...t, ...flags }))
            setExpanded((e) => ({ ...e, ...flags }))
            return
          }
          onReadyToSellVariant?.(index)
        }

        return (
          <div key={key} className={styles.variantCard}>
            <button
              type="button"
              className={styles.variantHeader}
              onClick={() => toggle(key)}
              aria-expanded={isOpen}
            >
              <span className={styles.variantTag}>{variant.name || `Variant ${index + 1}`}</span>
              {isLive && <span className={styles.sellingTag}>Currently Selling</span>}
              <ChevronDown
                size={16}
                strokeWidth={ICON_STROKE_WIDTH}
                className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                aria-hidden
              />
            </button>

            {isOpen && (
              <div className={styles.variantBody}>
                {/* The lock is per-variant, so it is reported per-variant. A
                    sibling variant that is still a draft stays fully editable
                    and shows nothing. */}
                {isLive && (
                  <div className={styles.variantLockedBanner}>
                    <span className={styles.variantLockedBadge}>Locked</span>
                    <div>
                      <strong>This variant is on sale and frozen.</strong>{' '}
                      {isAdmin
                        ? 'Only its price can change — raise it as copies sell. Unblock it below to edit anything else.'
                        : 'Only its price can change — raise it as copies sell. Ask an admin to unblock it to edit anything else.'}
                    </div>
                  </div>
                )}
                <div className={dashboardStyles.field}>
                  <label>Name</label>
                  <Input
                    type="text"
                    size="medium"
                    value={variant.name}
                    disabled={variantLocked}
                    placeholder="e.g. Small"
                    invalid={!!errFor('name')}
                    onChange={(e) => update(index, { name: e.target.value })}
                  />
                  <ErrorText>{errFor('name')}</ErrorText>
                </div>

                <div className={dashboardStyles.field}>
                  <label>Paper</label>
                  <SelectDropdown<string>
                    options={PAPER_OPTIONS}
                    value={variant.paperId}
                    disabled={variantLocked}
                    onChange={(v) => update(index, { paperId: v })}
                  />
                </div>

                <div className={dashboardStyles.field}>
                  <label>Sheet size</label>
                  <div className={styles.modeToggle} role="group" aria-label="Sheet size mode">
                    <Button
                      type="button"
                      variant={isFixed ? 'secondary' : 'primary'}
                      disabled={variantLocked}
                      onClick={() => setSheetMode(index, false)}
                    >
                      Grows with the print
                    </Button>
                    <Button
                      type="button"
                      variant={isFixed ? 'primary' : 'secondary'}
                      disabled={variantLocked}
                      onClick={() => setSheetMode(index, true)}
                    >
                      Fixed sheet
                    </Button>
                  </div>
                  <span className={styles.hint}>
                    {isFixed
                      ? 'You set the paper size; the print is sized to fit inside it and the borders are worked out for you.'
                      : 'The paper grows around the print — print size plus the border on every side.'}
                  </span>
                </div>

                {isFixed ? (
                  <div className={styles.twoCol}>
                    <div className={dashboardStyles.field}>
                      <label>Sheet height (cm)</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        size="medium"
                        value={variant.sheetHeightCm ? String(variant.sheetHeightCm) : ''}
                        disabled={variantLocked}
                        invalid={!!errFor('sheet')}
                        onChange={(e) =>
                          updateSheet(index, {
                            sheetHeightCm: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0,
                          })
                        }
                      />
                    </div>
                    <div className={dashboardStyles.field}>
                      <label>Sheet width (cm)</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        size="medium"
                        value={variant.sheetWidthCm ? String(variant.sheetWidthCm) : ''}
                        disabled={variantLocked}
                        invalid={!!errFor('sheet')}
                        onChange={(e) =>
                          updateSheet(index, {
                            sheetWidthCm: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className={dashboardStyles.field}>
                    <label>Print size (cm)</label>
                    <CustomSizeInputs
                      custom={SIZE_CUSTOM}
                      aspectRatio={aspectRatio}
                      longEdgeBounds={longEdgeBounds}
                      customSize={{ widthCm: variant.widthCm, heightCm: variant.heightCm }}
                      disabled={variantLocked}
                      showSlider={false}
                      onChange={(size) =>
                        update(index, { widthCm: size.widthCm, heightCm: size.heightCm })
                      }
                    />
                  </div>
                )}
                <ErrorText>{errFor('size')}</ErrorText>
                <ErrorText>{errFor('sheet')}</ErrorText>
                {duplicateSize && (
                  <ErrorText>
                    Each variant must have a distinct print size — this one clashes with another.
                  </ErrorText>
                )}

                {/* Border + number of copies — one row, 50% each. */}
                <div className={styles.twoCol}>
                  <div className={dashboardStyles.field}>
                    <label>Border (cm)</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      size="medium"
                      value={variant.borderCm ? String(variant.borderCm) : ''}
                      disabled={variantLocked}
                      invalid={!!errFor('border')}
                      onChange={(e) => {
                        const borderCm = Number(e.target.value.replace(/[^0-9]/g, '')) || 0
                        const next = { ...variant, borderCm }
                        update(index, { borderCm, ...withDerivedImage(next) })
                      }}
                    />
                    <span className={styles.hint}>min {LIMITED_BORDER_MIN_CM} cm, whole cm</span>
                    <ErrorText>{errFor('border')}</ErrorText>
                  </div>
                  <div className={dashboardStyles.field}>
                    <label>Number of copies</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      size="medium"
                      value={variant.editionSize ? String(variant.editionSize) : ''}
                      disabled={variantLocked}
                      invalid={!!errFor('editionSize')}
                      onChange={(e) =>
                        update(index, {
                          editionSize: Number(e.target.value.replace(/[^0-9]/g, '')) || 0,
                        })
                      }
                    />
                    <span className={styles.hint}>How many numbered prints exist.</span>
                    <ErrorText>{errFor('editionSize')}</ErrorText>
                  </div>
                </div>

                {(() => {
                  const paperLabel =
                    TPS_PAPERS.find((p) => p.id === variant.paperId)?.label ?? variant.paperId
                  const recipe = buildTpsRecipe({
                    widthCm: variant.widthCm,
                    heightCm: variant.heightCm,
                    borderCm: variant.borderCm,
                    sheetWidthCm: variant.sheetWidthCm,
                    sheetHeightCm: variant.sheetHeightCm,
                    paperLabel,
                  })
                  if (!recipe) return null
                  const text = formatTpsRecipe(recipe, {
                    title: variant.name || `Variant ${index + 1}`,
                  })
                  return (
                    <div className={styles.layoutSummary}>
                      {/* Our own convention: height x width. */}
                      <p className={styles.layoutLine}>
                        <strong>Sheet</strong> {recipe.sheetHeightCm.toFixed(1)} ×{' '}
                        {recipe.sheetWidthCm.toFixed(1)} cm · <strong>Print</strong>{' '}
                        {recipe.expectedImageHeightCm.toFixed(1)} ×{' '}
                        {recipe.expectedImageWidthCm.toFixed(1)} cm · <strong>Borders</strong>{' '}
                        {recipe.expectedBorderYCm.toFixed(1)} top/bottom,{' '}
                        {recipe.expectedBorderXCm.toFixed(1)} left/right cm
                      </p>
                      <details className={styles.recipeDetails}>
                        <summary>Print lab setup</summary>
                        <pre className={styles.recipe}>{text}</pre>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => navigator.clipboard?.writeText(text)}
                        >
                          Copy setup
                        </Button>
                      </details>
                    </div>
                  )
                })()}

                <div className={dashboardStyles.field} style={{ maxWidth: 240 }}>
                  <label>Your price for this variant (&euro;)</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    size="medium"
                    value={variant.priceEuros ?? ''}
                    // Price stays editable even when the variant is locked — the
                    // artist can raise it as the edition sells. Every other field
                    // is frozen (size + edition size are materialised).
                    disabled={false}
                    placeholder="Add your price here"
                    invalid={!!errFor('price')}
                    onChange={(e) =>
                      update(index, {
                        priceEuros: e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''),
                      })
                    }
                  />
                  <span className={styles.hint}>
                    {variantLocked
                      ? 'The edition is live — you can still adjust the price; every other field is locked.'
                      : 'What you earn per print of this variant'}
                  </span>
                  <ErrorText>{errFor('price')}</ErrorText>
                </div>

                {(showUnblock || showReadyToSell || showDelete) && (
                  <div className={styles.variantFooter}>
                    {/* Admin shortcut: consume a number of this variant
                        off-platform (gift / artist copy / test) — jumps to the
                        Edition Sales modal preselected on this variant.
                        Gated on `published` (numbers exist), NOT on `isLive`:
                        a published-but-unblocked variant is paused from sale
                        yet can still gift a copy, which is how a gift goes out
                        before the edition is offered to buyers. Matches
                        listGiftableVariants + createOffPlatformOrder, which
                        both check `published` only. */}
                    {isAdmin && variant.published === true && variant.id && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          window.location.href = `/admin/edition-sales?gift=${variant.id}`
                        }}
                      >
                        Create gift order
                      </Button>
                    )}
                    {/* Off-sale variant (draft or admin-unblocked): put it on sale. */}
                    {showReadyToSell && (
                      <Button type="button" variant="primary" onClick={handleReadyToSell}>
                        Ready to Sell
                      </Button>
                    )}
                    {/* Live variant: take it off sale to edit it — admin only. */}
                    {showUnblock && variant.id && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onUnblockVariant?.(variant.id as string)}
                      >
                        Unblock
                      </Button>
                    )}
                    {showDelete && (
                      <Button type="button" variant="danger" onClick={() => remove(index)}>
                        Delete variant
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Adding is bounded only by the max — with per-variant publishing the
          artist can keep adding (and going live with) new variants even after
          earlier ones are on sale. "Apply saved variant" reuses a spec from
          the artist's other artworks instead of retyping it. */}
      {variants.length < MAX_LIMITED_VARIANTS && (
        <div className={styles.addRow}>
          <Button type="button" variant="secondary" onClick={add}>
            + Add variant
          </Button>
          {artworkId && (
            <Button type="button" variant="secondary" onClick={openTemplatePicker}>
              ↻ Apply saved variant
            </Button>
          )}
        </div>
      )}

      {templatePickerOpen && (
        <div className={styles.templatePicker}>
          {templatesLoading ? (
            <span className={styles.hint}>Loading saved variants…</span>
          ) : templatesError ? (
            <ErrorText>{templatesError}</ErrorText>
          ) : templates && templates.length === 0 ? (
            <span className={styles.hint}>
              No saved variants match this artwork&apos;s exact proportions. Only variants from
              artworks with the SAME aspect ratio appear here, so the print size and margins apply
              identically across the series. Differently-proportioned images need their own variant.
            </span>
          ) : templates ? (
            <SelectDropdown<string>
              options={templates.map((t, i) => ({
                value: String(i),
                label: `${t.name} — ${t.widthCm}×${t.heightCm} cm · ${
                  TPS_PAPERS.find((p) => p.id === t.paperId)?.label ?? t.paperId
                } · /${t.editionSize} (from “${t.sourceArtworkTitle}”)`,
              }))}
              value={''}
              placeholder="Pick a saved variant to apply…"
              onChange={(v) => {
                const t = templates[Number(v)]
                if (t) applyTemplate(t)
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
