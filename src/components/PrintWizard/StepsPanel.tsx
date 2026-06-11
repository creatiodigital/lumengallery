'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'

import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { Icon } from '@/components/ui/Icon'
import { SelectDropdown } from '@/components/ui/SelectDropdown'
import { Slider } from '@/components/ui/Slider'
import type { SelectOption } from '@/components/ui/SelectDropdown'

import { CustomSizeInputs } from './CustomSizeInputs'

import {
  type AvailabilityCheck,
  type BorderDimension,
  type Catalog,
  type Dimension,
  type EnumDimension,
  type Option,
  type PrintRecommendations,
  type PrintRestrictions,
  type SizeDimension,
  type SizeOption,
  type WizardConfig,
  clampCm,
  formatDualDimensions,
  isDimensionVisible,
  isOptionPickable,
} from '@/lib/print-providers'
import { type PrintLongEdgeBounds } from '@/lib/print-providers/printspace'

import styles from './PrintWizard.module.scss'

interface StepsPanelProps {
  catalog: Catalog
  config: WizardConfig
  aspectRatio: number
  /** Per-artwork long-edge cm bounds, derived from file resolution +
   *  the print-lab's hardware limits. Drives the size slider's range. */
  longEdgeBounds: PrintLongEdgeBounds | null
  onChange: (patch: Record<string, string>) => void
  onCustomSizeChange: (size: { widthCm: number; heightCm: number }) => void
  onBorderChange: (dimensionId: string, allCm: number) => void
  availability: AvailabilityCheck
  restrictions: PrintRestrictions | null
  recommendations: PrintRecommendations | null
}

export const StepsPanel = ({
  catalog,
  config,
  aspectRatio,
  longEdgeBounds,
  onChange,
  onCustomSizeChange,
  onBorderChange,
  availability,
  restrictions,
  recommendations,
}: StepsPanelProps) => {
  // Per-step open/closed state. Keyed by dimension id. Independent —
  // buyer can have any combination open at once. Country isn't picked
  // here any more (lives on the checkout step), so every section
  // available is for the print configuration itself.
  const [openSteps, setOpenSteps] = useState<Set<string>>(() => new Set())
  const toggle = (key: string) => (open: boolean) => {
    setOpenSteps((prev) => {
      const next = new Set(prev)
      if (open) next.add(key)
      else next.delete(key)
      return next
    })
  }

  // Country never gates option selection here — the checkout step
  // handles destination and re-quotes. The catalog ships everything
  // everywhere, so options stay unlocked always.
  const countryCode = ''
  const optionsLocked = false

  return (
    <aside className={styles.stepsPanel}>
      {(() => {
        // The catalog bundles a few dimensions that are read as one decision:
        //   - printType + paper       (paper is filtered by process)
        //   - format + frameType + moulding (frame parts only matter
        //     once the buyer opts into framing)
        // We render those as single sections so the buyer doesn't see
        // 5 separate dropdowns for what is really 2 questions. Each
        // group renders in place of its leader dimension, preserving
        // the catalog's declared order.
        const dimsById = new Map(catalog.dimensions.map((d) => [d.id, d]))
        const printType = dimsById.get('printType')
        const paper = dimsById.get('paper')
        const size = dimsById.get('size')
        const border = dimsById.get('border')
        const format = dimsById.get('format')
        const frameType = dimsById.get('frameType')
        const moulding = dimsById.get('moulding')
        const glass = dimsById.get('glass')
        const hanging = dimsById.get('hanging')
        const windowMount = dimsById.get('windowMount')
        const windowMountSize = dimsById.get('windowMountSize')

        const printGrouped =
          printType && paper && printType.kind === 'enum' && paper.kind === 'enum'
        const sizeGrouped = size && border && size.kind === 'size' && border.kind === 'border'
        const frameGrouped =
          format &&
          frameType &&
          moulding &&
          format.kind === 'enum' &&
          frameType.kind === 'enum' &&
          moulding.kind === 'enum'

        const groupLeader = new Map<string, 'print' | 'size' | 'frame'>()
        if (printGrouped) {
          groupLeader.set('printType', 'print')
          groupLeader.set('paper', 'print')
        }
        if (sizeGrouped) {
          // Paper border is a size-shaping decision (extra white
          // space around the image), so it lives next to the print
          // size itself rather than in its own section.
          groupLeader.set('size', 'size')
          groupLeader.set('border', 'size')
        }
        if (frameGrouped) {
          // Everything that only matters once the buyer opts into
          // framing lives in one section: frame parts, glass, hanging,
          // and the passepartout (window mount + its size slider).
          // Without framing none of these have meaningful values.
          groupLeader.set('format', 'frame')
          groupLeader.set('frameType', 'frame')
          groupLeader.set('moulding', 'frame')
          if (glass?.kind === 'enum') groupLeader.set('glass', 'frame')
          if (hanging?.kind === 'enum') groupLeader.set('hanging', 'frame')
          if (windowMount?.kind === 'enum') groupLeader.set('windowMount', 'frame')
          if (windowMountSize?.kind === 'border') groupLeader.set('windowMountSize', 'frame')
        }

        return (
          <>
            {catalog.dimensions.map((dim) => {
              const group = groupLeader.get(dim.id)
              if (group === 'print' && dim.id !== 'printType') return null
              if (group === 'size' && dim.id !== 'size') return null
              if (group === 'frame' && dim.id !== 'format') return null
              if (group === 'print' && printGrouped && printType && paper) {
                return (
                  <PrintAndPaperSection
                    key="printAndPaper"
                    printType={printType}
                    paper={paper}
                    config={config}
                    countryCode={countryCode}
                    availability={availability}
                    restrictions={restrictions}
                    recommendations={recommendations}
                    optionsLocked={optionsLocked}
                    open={openSteps.has('printAndPaper')}
                    onToggle={toggle('printAndPaper')}
                    onChange={onChange}
                  />
                )
              }
              if (group === 'size' && sizeGrouped && size && border) {
                return (
                  <SizeAndBorderSection
                    key="sizeAndBorder"
                    size={size}
                    border={border}
                    config={config}
                    aspectRatio={aspectRatio}
                    longEdgeBounds={longEdgeBounds}
                    optionsLocked={optionsLocked}
                    open={openSteps.has('sizeAndBorder')}
                    onToggle={toggle('sizeAndBorder')}
                    onCustomSizeChange={onCustomSizeChange}
                    onBorderChange={onBorderChange}
                  />
                )
              }
              if (group === 'frame' && frameGrouped && format && frameType && moulding) {
                return (
                  <FrameSection
                    key="frameGroup"
                    format={format}
                    frameType={frameType}
                    moulding={moulding}
                    glass={glass?.kind === 'enum' ? glass : undefined}
                    hanging={hanging?.kind === 'enum' ? hanging : undefined}
                    windowMount={windowMount?.kind === 'enum' ? windowMount : undefined}
                    windowMountSize={
                      windowMountSize?.kind === 'border' ? windowMountSize : undefined
                    }
                    catalog={catalog}
                    config={config}
                    countryCode={countryCode}
                    availability={availability}
                    restrictions={restrictions}
                    optionsLocked={optionsLocked}
                    open={openSteps.has('frameGroup')}
                    onToggle={toggle('frameGroup')}
                    onChange={onChange}
                    onBorderChange={onBorderChange}
                  />
                )
              }
              return (
                <DimensionSection
                  key={dim.id}
                  dimension={dim}
                  catalog={catalog}
                  config={config}
                  aspectRatio={aspectRatio}
                  longEdgeBounds={longEdgeBounds}
                  countryCode={countryCode}
                  availability={availability}
                  restrictions={restrictions}
                  optionsLocked={optionsLocked}
                  open={openSteps.has(dim.id)}
                  onToggle={toggle(dim.id)}
                  onChange={onChange}
                  onCustomSizeChange={onCustomSizeChange}
                  onBorderChange={onBorderChange}
                />
              )
            })}
          </>
        )
      })()}
    </aside>
  )
}

// ── Print + Paper grouped section ──────────────────────────

interface PrintAndPaperSectionProps {
  printType: EnumDimension
  paper: EnumDimension
  config: WizardConfig
  countryCode: string
  availability: AvailabilityCheck
  restrictions: PrintRestrictions | null
  recommendations: PrintRecommendations | null
  optionsLocked: boolean
  open: boolean
  onToggle: (open: boolean) => void
  onChange: (patch: Record<string, string>) => void
}

const PrintAndPaperSection = ({
  printType,
  paper,
  config,
  countryCode,
  availability,
  restrictions,
  recommendations,
  optionsLocked,
  open,
  onToggle,
  onChange,
}: PrintAndPaperSectionProps) => {
  const filterPickable = (dim: EnumDimension) =>
    dim.options.filter((option) =>
      isOptionPickable(option, {
        dimensionId: dim.id,
        config,
        country: countryCode,
        availability,
        restrictions,
      }),
    )

  const printTypeOptions: SelectOption<string>[] = useMemo(
    () =>
      filterPickable(printType).map((option) => ({
        value: option.id,
        label: option.label,
        tooltip: optionTooltip(option),
        tooltipImage: option.tooltipImageUrl ? (
          // unoptimized: catalog image; skip the Vercel optimizer whose cold
          // re-encode broke images on first load (AR-125).
          <Image src={option.tooltipImageUrl} alt="" width={220} height={220} unoptimized />
        ) : undefined,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [printType, config, countryCode, availability, restrictions],
  )

  const recommendedPaperIds = useMemo(
    () => new Set(recommendations?.paper ?? []),
    [recommendations],
  )
  const paperOptions: SelectOption<string>[] = useMemo(
    () =>
      filterPickable(paper).map((option) => {
        const isRecommended = recommendedPaperIds.has(option.id)
        return {
          value: option.id,
          label: option.label,
          tooltip: optionTooltip(option, isRecommended),
          tooltipImage: option.tooltipImageUrl ? (
            // unoptimized: catalog image; skip the Vercel optimizer (AR-125).
            <Image src={option.tooltipImageUrl} alt="" width={220} height={220} unoptimized />
          ) : undefined,
          badge: isRecommended ? (
            <Icon name="check-circle" size={16} aria-label="Recommended by the artist" />
          ) : undefined,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paper, config, countryCode, availability, restrictions, recommendedPaperIds],
  )

  return (
    <CollapsibleSection title="Print" open={open} onToggle={onToggle}>
      <div className={styles.stepField}>
        <SelectDropdown<string>
          label="Type"
          options={printTypeOptions}
          value={config.values[printType.id] ?? ''}
          onChange={(v) => onChange({ [printType.id]: v })}
          disabled={optionsLocked}
        />
      </div>
      <div className={styles.stepField}>
        <SelectDropdown<string>
          label={paper.label}
          options={paperOptions}
          value={config.values[paper.id] ?? ''}
          onChange={(v) => onChange({ [paper.id]: v })}
          disabled={optionsLocked}
        />
      </div>
    </CollapsibleSection>
  )
}

// ── Size + Paper border grouped section ───────────────────
//
// Paper border is a size-shaping decision (extra paper around the
// image), so it sits inside the same section as Print size rather
// than as its own collapsible.

interface SizeAndBorderSectionProps {
  size: SizeDimension
  border: BorderDimension
  config: WizardConfig
  aspectRatio: number
  longEdgeBounds: PrintLongEdgeBounds | null
  optionsLocked: boolean
  open: boolean
  onToggle: (open: boolean) => void
  onCustomSizeChange: (size: { widthCm: number; heightCm: number }) => void
  onBorderChange: (dimensionId: string, allCm: number) => void
}

const SizeAndBorderSection = ({
  size,
  border,
  config,
  aspectRatio,
  longEdgeBounds,
  optionsLocked,
  open,
  onToggle,
  onCustomSizeChange,
  onBorderChange,
}: SizeAndBorderSectionProps) => {
  return (
    <CollapsibleSection title={size.label} open={open} onToggle={onToggle}>
      <div className={styles.stepField}>
        <CustomSizeInputs
          custom={size.custom}
          aspectRatio={aspectRatio}
          longEdgeBounds={longEdgeBounds}
          customSize={config.customSize}
          disabled={optionsLocked}
          onChange={onCustomSizeChange}
        />
      </div>
      <BorderSlider
        dim={border}
        config={config}
        optionsLocked={optionsLocked}
        onBorderChange={onBorderChange}
      />
    </CollapsibleSection>
  )
}

// ── Frame grouped section ─────────────────────────────────
//
// Bundles every framing-conditional dimension into one section. The
// format dropdown is always rendered; the rest only show when the
// buyer chose to frame. windowMountSize follows the catalog's own
// visibility rule (only when a non-'none' mount colour is picked).

interface FrameSectionProps {
  format: EnumDimension
  frameType: EnumDimension
  moulding: EnumDimension
  glass?: EnumDimension
  hanging?: EnumDimension
  windowMount?: EnumDimension
  windowMountSize?: BorderDimension
  catalog: Catalog
  config: WizardConfig
  countryCode: string
  availability: AvailabilityCheck
  restrictions: PrintRestrictions | null
  optionsLocked: boolean
  open: boolean
  onToggle: (open: boolean) => void
  onChange: (patch: Record<string, string>) => void
  onBorderChange: (dimensionId: string, allCm: number) => void
}

const FrameSection = ({
  format,
  frameType,
  moulding,
  glass,
  hanging,
  windowMount,
  windowMountSize,
  catalog,
  config,
  countryCode,
  availability,
  restrictions,
  optionsLocked,
  open,
  onToggle,
  onChange,
  onBorderChange,
}: FrameSectionProps) => {
  const isFraming = config.values[format.id] === 'framing'

  return (
    <CollapsibleSection title="Frame" open={open} onToggle={onToggle}>
      <EnumDropdown
        dim={format}
        config={config}
        countryCode={countryCode}
        availability={availability}
        restrictions={restrictions}
        optionsLocked={optionsLocked}
        onChange={onChange}
      />
      {isFraming && (
        <>
          <EnumDropdown
            dim={frameType}
            config={config}
            countryCode={countryCode}
            availability={availability}
            restrictions={restrictions}
            optionsLocked={optionsLocked}
            onChange={onChange}
          />
          <EnumDropdown
            dim={moulding}
            config={config}
            countryCode={countryCode}
            availability={availability}
            restrictions={restrictions}
            optionsLocked={optionsLocked}
            onChange={onChange}
          />
          {glass && isDimensionVisible(glass, config, catalog) && (
            <EnumDropdown
              dim={glass}
              config={config}
              countryCode={countryCode}
              availability={availability}
              restrictions={restrictions}
              optionsLocked={optionsLocked}
              onChange={onChange}
            />
          )}
          {windowMount && isDimensionVisible(windowMount, config, catalog) && (
            <EnumDropdown
              dim={windowMount}
              config={config}
              countryCode={countryCode}
              availability={availability}
              restrictions={restrictions}
              optionsLocked={optionsLocked}
              onChange={onChange}
            />
          )}
          {windowMountSize && isDimensionVisible(windowMountSize, config, catalog) && (
            <BorderSlider
              dim={windowMountSize}
              config={config}
              optionsLocked={optionsLocked}
              onBorderChange={onBorderChange}
            />
          )}
          {hanging && (
            <EnumDropdown
              dim={hanging}
              config={config}
              countryCode={countryCode}
              availability={availability}
              restrictions={restrictions}
              optionsLocked={optionsLocked}
              onChange={onChange}
            />
          )}
        </>
      )}
    </CollapsibleSection>
  )
}

// Bare enum dropdown — same logic as EnumDimensionSection but without
// the outer CollapsibleSection wrapper, so it can be used inside a
// grouped section.
const EnumDropdown = ({
  dim,
  config,
  countryCode,
  availability,
  restrictions,
  optionsLocked,
  onChange,
}: {
  dim: EnumDimension
  config: WizardConfig
  countryCode: string
  availability: AvailabilityCheck
  restrictions: PrintRestrictions | null
  optionsLocked: boolean
  onChange: (patch: Record<string, string>) => void
}) => {
  const filtered = useMemo(
    () =>
      dim.options.filter((option) =>
        isOptionPickable(option, {
          dimensionId: dim.id,
          config,
          country: countryCode,
          availability,
          restrictions,
        }),
      ),
    [dim, config, countryCode, availability, restrictions],
  )

  const selectOptions: SelectOption<string>[] = useMemo(
    () =>
      filtered.map((option) => ({
        value: option.id,
        label: option.label,
        tooltip: optionTooltip(option),
        tooltipImage: option.tooltipImageUrl ? (
          // unoptimized: catalog image; skip the Vercel optimizer whose cold
          // re-encode broke images on first load (AR-125).
          <Image src={option.tooltipImageUrl} alt="" width={220} height={220} unoptimized />
        ) : undefined,
      })),
    [filtered],
  )

  return (
    <div className={styles.stepField}>
      <SelectDropdown<string>
        label={dim.label}
        options={selectOptions}
        value={config.values[dim.id] ?? ''}
        onChange={(v) => onChange({ [dim.id]: v })}
        disabled={optionsLocked}
      />
    </div>
  )
}

// Bare border slider — mirrors BorderDimensionSection's inner content
// without the outer CollapsibleSection.
const BorderSlider = ({
  dim,
  config,
  optionsLocked,
  onBorderChange,
}: {
  dim: BorderDimension
  config: WizardConfig
  optionsLocked: boolean
  onBorderChange: (dimensionId: string, allCm: number) => void
}) => {
  const value = config.borders?.[dim.id]?.allCm ?? dim.defaultCm
  const decimals = dim.stepCm >= 1 ? 0 : Math.ceil(-Math.log10(dim.stepCm))
  const displayed = parseFloat(value.toFixed(decimals)).toString()
  return (
    <div className={styles.stepField}>
      <span className={styles.stepFieldLabel}>{dim.label}</span>
      <p className={styles.sliderValue}>{displayed} cm</p>
      <Slider
        min={dim.minCm}
        max={dim.maxCm}
        step={dim.stepCm}
        value={value}
        disabled={optionsLocked}
        onChange={(v) => onBorderChange(dim.id, clampCm(v, dim.minCm, dim.maxCm, dim.stepCm))}
        aria-label={dim.label}
      />
      {dim.helpText && <p className={styles.destinationHelp}>{dim.helpText}</p>}
    </div>
  )
}

// ── Per-dimension renderer ───────────────────────────────────────

interface DimensionSectionProps {
  dimension: Dimension
  catalog: Catalog
  config: WizardConfig
  aspectRatio: number
  longEdgeBounds: PrintLongEdgeBounds | null
  countryCode: string
  availability: AvailabilityCheck
  restrictions: PrintRestrictions | null
  optionsLocked: boolean
  open: boolean
  onToggle: (open: boolean) => void
  onChange: (patch: Record<string, string>) => void
  onCustomSizeChange: (size: { widthCm: number; heightCm: number }) => void
  onBorderChange: (dimensionId: string, allCm: number) => void
}

const DimensionSection = ({
  dimension,
  catalog,
  config,
  aspectRatio,
  longEdgeBounds,
  countryCode,
  availability,
  restrictions,
  optionsLocked,
  open,
  onToggle,
  onChange,
  onCustomSizeChange,
  onBorderChange,
}: DimensionSectionProps) => {
  const aspectRatioForChild = aspectRatio
  if (!isDimensionVisible(dimension, config, catalog)) return null

  if (dimension.kind === 'size') {
    return (
      <SizeDimensionSection
        dimension={dimension}
        config={config}
        aspectRatio={aspectRatioForChild}
        longEdgeBounds={longEdgeBounds}
        countryCode={countryCode}
        availability={availability}
        restrictions={restrictions}
        optionsLocked={optionsLocked}
        open={open}
        onToggle={onToggle}
        onChange={onChange}
        onCustomSizeChange={onCustomSizeChange}
      />
    )
  }

  if (dimension.kind === 'border') {
    return (
      <BorderDimensionSection
        dimension={dimension}
        config={config}
        optionsLocked={optionsLocked}
        open={open}
        onToggle={onToggle}
        onBorderChange={onBorderChange}
      />
    )
  }

  // kind === 'enum'
  return (
    <EnumDimensionSection
      dimension={dimension}
      config={config}
      countryCode={countryCode}
      availability={availability}
      restrictions={restrictions}
      optionsLocked={optionsLocked}
      open={open}
      onToggle={onToggle}
      onChange={onChange}
    />
  )
}

// ── Enum dimensions ──────────────────────────────────────────────

interface EnumSectionProps extends Omit<
  DimensionSectionProps,
  | 'dimension'
  | 'catalog'
  | 'aspectRatio'
  | 'longEdgeBounds'
  | 'onCustomSizeChange'
  | 'onBorderChange'
> {
  dimension: EnumDimension
}

const EnumDimensionSection = ({
  dimension,
  config,
  countryCode,
  availability,
  restrictions,
  optionsLocked,
  open,
  onToggle,
  onChange,
}: EnumSectionProps) => {
  const filtered = useMemo(
    () =>
      dimension.options.filter((option) =>
        isOptionPickable(option, {
          dimensionId: dimension.id,
          config,
          country: countryCode,
          availability,
          restrictions,
        }),
      ),
    [dimension, config, countryCode, availability, restrictions],
  )

  const selectOptions: SelectOption<string>[] = useMemo(
    () =>
      filtered.map((option) => ({
        value: option.id,
        label: option.label,
        tooltip: optionTooltip(option),
        tooltipImage: option.tooltipImageUrl ? (
          // unoptimized: catalog image; skip the Vercel optimizer whose cold
          // re-encode broke images on first load (AR-125).
          <Image src={option.tooltipImageUrl} alt="" width={220} height={220} unoptimized />
        ) : undefined,
      })),
    [filtered],
  )

  return (
    <CollapsibleSection title={dimension.label} open={open} onToggle={onToggle}>
      <div className={styles.stepField}>
        <SelectDropdown<string>
          options={selectOptions}
          value={config.values[dimension.id] ?? ''}
          onChange={(v) => onChange({ [dimension.id]: v })}
          disabled={optionsLocked}
        />
      </div>
    </CollapsibleSection>
  )
}

// ── Size dimension ───────────────────────────────────────────────

interface SizeSectionProps extends Omit<
  DimensionSectionProps,
  'dimension' | 'catalog' | 'onBorderChange'
> {
  dimension: SizeDimension
}

const SizeDimensionSection = ({
  dimension,
  config,
  aspectRatio,
  longEdgeBounds,
  countryCode,
  availability,
  restrictions,
  optionsLocked,
  open,
  onToggle,
  onChange,
  onCustomSizeChange,
}: SizeSectionProps) => {
  const filtered = useMemo(() => {
    return dimension.options
      .filter((o) => o.printEligible)
      .filter((o) =>
        isOptionPickable(o, {
          dimensionId: dimension.id,
          config,
          country: countryCode,
          availability,
          restrictions,
        }),
      )
  }, [dimension, config, countryCode, availability, restrictions])

  const sorted = useMemo(() => {
    const order: Record<SizeOption['fit'], number> = { perfect: 0, close: 1, mismatch: 2 }
    return [...filtered].sort((a, b) => order[a.fit] - order[b.fit])
  }, [filtered])

  const hasPresets = dimension.options.length > 0
  const customMode = !hasPresets && dimension.custom !== undefined

  const selectOptions: SelectOption<string>[] = useMemo(
    () =>
      sorted.map((size) => ({
        value: size.id,
        label: formatDualDimensions(size.widthCm, size.heightCm),
        tooltip: (
          <p>
            This size matches your artwork&apos;s aspect ratio — the whole image prints without
            cropping or padding.
          </p>
        ),
      })),
    [sorted],
  )

  return (
    <CollapsibleSection title={dimension.label} open={open} onToggle={onToggle}>
      <div className={styles.stepField}>
        {customMode ? (
          <CustomSizeInputs
            custom={dimension.custom}
            aspectRatio={aspectRatio}
            longEdgeBounds={longEdgeBounds}
            customSize={config.customSize}
            disabled={optionsLocked}
            onChange={onCustomSizeChange}
          />
        ) : (
          <SelectDropdown<string>
            options={selectOptions}
            value={config.values[dimension.id] ?? ''}
            onChange={(v) => onChange({ [dimension.id]: v })}
            disabled={optionsLocked}
          />
        )}
      </div>
    </CollapsibleSection>
  )
}

// ── Border dimension (uniform) ──────────────────────────────────

interface BorderSectionProps {
  dimension: BorderDimension
  config: WizardConfig
  optionsLocked: boolean
  open: boolean
  onToggle: (open: boolean) => void
  onBorderChange: (dimensionId: string, allCm: number) => void
}

const BorderDimensionSection = ({
  dimension,
  config,
  optionsLocked,
  open,
  onToggle,
  onBorderChange,
}: BorderSectionProps) => {
  const value = config.borders?.[dimension.id]?.allCm ?? dimension.defaultCm
  const decimals = dimension.stepCm >= 1 ? 0 : Math.ceil(-Math.log10(dimension.stepCm))
  // Strip trailing zeros so 0 → "0", 1.0 → "1", 0.3 stays "0.3".
  const displayed = parseFloat(value.toFixed(decimals)).toString()
  return (
    <CollapsibleSection title={dimension.label} open={open} onToggle={onToggle}>
      <div className={styles.stepField}>
        <p className={styles.sliderValue}>{displayed} cm</p>
        <Slider
          min={dimension.minCm}
          max={dimension.maxCm}
          step={dimension.stepCm}
          value={value}
          disabled={optionsLocked}
          onChange={(v) =>
            onBorderChange(
              dimension.id,
              clampCm(v, dimension.minCm, dimension.maxCm, dimension.stepCm),
            )
          }
          aria-label={dimension.label}
        />
        {dimension.helpText && <p className={styles.destinationHelp}>{dimension.helpText}</p>}
      </div>
    </CollapsibleSection>
  )
}

// ── Tooltip helper ───────────────────────────────────────────────

function optionTooltip(option: Option, recommended?: boolean): ReactNode {
  if (!option.description && !recommended && !option.tooltipHeaderImageUrl) return undefined
  return (
    <>
      {option.tooltipHeaderImageUrl && (
        <div className={styles.tooltipHeaderImage}>
          <Image
            src={option.tooltipHeaderImageUrl}
            alt=""
            width={640}
            height={360}
            sizes="320px"
            unoptimized
          />
        </div>
      )}
      <p>
        <strong>{option.label}</strong>
      </p>
      {option.description && <p>{option.description}</p>}
      {recommended && (
        <p className={styles.recommendationLegend}>
          <Icon name="check-circle" size={14} aria-hidden />
          <span>Recommended by the artist for best results</span>
        </p>
      )}
    </>
  )
}
