'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { SelectDropdown } from '@/components/ui/SelectDropdown'
import { Slider } from '@/components/ui/Slider'
import type { SelectOption } from '@/components/ui/SelectDropdown'

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
  isDimensionVisible,
  isOptionPickable,
  sizeOptionLabel,
} from '@/lib/print-providers'
import { type PrintLongEdgeBounds, formatPrintSize } from '@/lib/print-providers/printspace'

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
          <Image src={option.tooltipImageUrl} alt="" width={220} height={220} />
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
            <Image src={option.tooltipImageUrl} alt="" width={220} height={220} />
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
          dimension={size}
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
          <Image src={option.tooltipImageUrl} alt="" width={220} height={220} />
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

  if (dimension.kind === 'orientation') {
    return (
      <CollapsibleSection title={dimension.label} open={open} onToggle={onToggle}>
        <div className={styles.stepField}>
          <p className={styles.destinationHelp}>
            How the print will be hung. Defaulted to match your artwork — flip it if you want a
            different hang.
          </p>
          <div className={styles.orientationChoices} role="radiogroup" aria-label="Orientation">
            {(['portrait', 'landscape'] as const).map((value) => {
              const selected = config.values.orientation === value
              return (
                <Button
                  key={value}
                  variant="ghost"
                  role="radio"
                  aria-checked={selected}
                  disabled={optionsLocked}
                  className={`${styles.orientationChoice} ${
                    selected ? styles.orientationChoiceSelected : ''
                  } ${optionsLocked ? styles.orientationChoiceDisabled : ''}`}
                  onClick={() => onChange({ orientation: value })}
                >
                  <span
                    className={`${styles.orientationIcon} ${
                      value === 'landscape' ? styles.orientationIconLandscape : ''
                    }`}
                    aria-hidden="true"
                  />
                  <span className={styles.orientationLabel}>
                    {value === 'portrait' ? 'Portrait' : 'Landscape'}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>
      </CollapsibleSection>
    )
  }

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
          <Image src={option.tooltipImageUrl} alt="" width={220} height={220} />
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
  const orientation: 'portrait' | 'landscape' =
    config.values.orientation === 'landscape' ? 'landscape' : 'portrait'

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
        label: sizeOptionLabel(size, orientation),
        tooltip: (
          <p>
            This size matches your artwork&apos;s aspect ratio — the whole image prints without
            cropping or padding.
          </p>
        ),
      })),
    [sorted, orientation],
  )

  return (
    <CollapsibleSection title={dimension.label} open={open} onToggle={onToggle}>
      <div className={styles.stepField}>
        {customMode ? (
          <CustomSizeInputs
            dimension={dimension}
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

// ── Custom size (height × width, aspect-locked) ──────────────────

interface CustomSizeInputsProps {
  dimension: SizeDimension
  aspectRatio: number
  longEdgeBounds: PrintLongEdgeBounds | null
  customSize: WizardConfig['customSize']
  disabled: boolean
  onChange: (size: { widthCm: number; heightCm: number }) => void
}

const CustomSizeInputs = ({
  dimension,
  aspectRatio,
  longEdgeBounds,
  customSize,
  disabled,
  onChange,
}: CustomSizeInputsProps) => {
  // Hooks must be called unconditionally on every render. We don't
  // bail out on `!custom` until after they've been declared, so the
  // hook order stays stable when the dimension switches between
  // custom-size and preset-size variants.
  const { custom } = dimension
  const widthCm = customSize?.widthCm ?? 0
  const heightCm = customSize?.heightCm ?? 0
  // Local string state so the user can type/clear freely without
  // each keystroke clamping mid-input. We commit (and clamp) on blur
  // or when the input parses to a valid in-range number — at which
  // point the partner field auto-updates from the locked aspect.
  const stepCmForInit = custom?.stepCm ?? 1
  const [widthInput, setWidthInput] = useState<string>(formatCm(widthCm, stepCmForInit))
  const [heightInput, setHeightInput] = useState<string>(formatCm(heightCm, stepCmForInit))
  const [editing, setEditing] = useState<'width' | 'height' | null>(null)

  if (!custom) return null

  // Sync local input with external customSize updates when the user
  // isn't actively typing in either field.
  if (editing === null) {
    const wStr = formatCm(widthCm, custom.stepCm)
    const hStr = formatCm(heightCm, custom.stepCm)
    if (wStr !== widthInput) setWidthInput(wStr)
    if (hStr !== heightInput) setHeightInput(hStr)
  }

  const aspectLocked = custom.aspectLocked === true
  // The aspect ratio in cm-space. Width / height. When the buyer
  // edits either field, the other follows from this ratio.
  const ratioWH = aspectLocked && aspectRatio > 0 ? aspectRatio : null

  // Effective per-axis bounds. When per-artwork longEdgeBounds is
  // available we use it (driven by file resolution + paper width);
  // otherwise fall back to the catalog defaults so the inputs still
  // function during the brief moment before bounds are computed.
  const effectiveMinLongCm = longEdgeBounds?.minLongCm ?? custom.minCm
  const effectiveMaxLongCm = longEdgeBounds?.maxLongCm ?? custom.maxCm
  const aspectShortOverLong =
    longEdgeBounds?.aspect ?? (ratioWH !== null ? Math.min(ratioWH, 1 / ratioWH) : 1)
  const isPortrait = longEdgeBounds?.isPortrait ?? (ratioWH !== null && ratioWH < 1)
  const minShortCm = effectiveMinLongCm * aspectShortOverLong
  const maxShortCm = effectiveMaxLongCm * aspectShortOverLong
  const minWidthCm = isPortrait ? minShortCm : effectiveMinLongCm
  const maxWidthCm = isPortrait ? maxShortCm : effectiveMaxLongCm
  const minHeightCm = isPortrait ? effectiveMinLongCm : minShortCm
  const maxHeightCm = isPortrait ? effectiveMaxLongCm : maxShortCm

  // Current long edge — drives the slider.
  const currentLongCm = Math.max(widthCm, heightCm)

  const commitLongEdge = (longCm: number) => {
    const clampedLong = clampCm(longCm, effectiveMinLongCm, effectiveMaxLongCm, custom.stepCm)
    const shortCm = clampedLong * aspectShortOverLong
    const newWidth = isPortrait ? shortCm : clampedLong
    const newHeight = isPortrait ? clampedLong : shortCm
    setWidthInput(formatCm(newWidth, custom.stepCm))
    setHeightInput(formatCm(newHeight, custom.stepCm))
    onChange({ widthCm: newWidth, heightCm: newHeight })
  }

  const handleChange = (which: 'width' | 'height', raw: string) => {
    if (which === 'width') setWidthInput(raw)
    else setHeightInput(raw)
    const parsed = Number(raw.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) return

    if (ratioWH === null) {
      // No aspect lock — both fields independent. (Unused with TPS,
      // but kept for symmetry with the catalog.)
      const w = which === 'width' ? clampCm(parsed, minWidthCm, maxWidthCm, custom.stepCm) : widthCm
      const h =
        which === 'height' ? clampCm(parsed, minHeightCm, maxHeightCm, custom.stepCm) : heightCm
      onChange({ widthCm: w, heightCm: h })
      return
    }

    // Aspect-locked: clamp the edited axis to its own per-axis range,
    // then derive the partner side via the aspect ratio so both land
    // within bounds simultaneously.
    let w: number
    let h: number
    if (which === 'width') {
      w = clampCm(parsed, minWidthCm, maxWidthCm, custom.stepCm)
      h = clampCm(w / ratioWH, minHeightCm, maxHeightCm, custom.stepCm)
      setHeightInput(formatCm(h, custom.stepCm))
    } else {
      h = clampCm(parsed, minHeightCm, maxHeightCm, custom.stepCm)
      w = clampCm(h * ratioWH, minWidthCm, maxWidthCm, custom.stepCm)
      setWidthInput(formatCm(w, custom.stepCm))
    }
    onChange({ widthCm: w, heightCm: h })
  }

  return (
    <div className={styles.customSizeRow}>
      <label className={styles.customSizeField}>
        <span>Height (cm)</span>
        <Input
          type="text"
          inputMode="decimal"
          value={heightInput}
          disabled={disabled}
          onFocus={() => setEditing('height')}
          onBlur={() => setEditing(null)}
          onChange={(e) => handleChange('height', e.target.value)}
          aria-label="Custom print height in centimeters"
        />
      </label>
      <span className={styles.customSizeSeparator} aria-hidden="true">
        ×
      </span>
      <label className={styles.customSizeField}>
        <span>Width (cm)</span>
        <Input
          type="text"
          inputMode="decimal"
          value={widthInput}
          disabled={disabled}
          onFocus={() => setEditing('width')}
          onBlur={() => setEditing(null)}
          onChange={(e) => handleChange('width', e.target.value)}
          aria-label="Custom print width in centimeters"
        />
      </label>
      <div className={styles.customSizeSlider}>
        <Slider
          min={effectiveMinLongCm}
          max={effectiveMaxLongCm}
          step={custom.stepCm}
          value={Math.min(effectiveMaxLongCm, Math.max(effectiveMinLongCm, currentLongCm))}
          disabled={disabled}
          onChange={(v) => commitLongEdge(v)}
          aria-label="Print size"
        />
        <div className={styles.customSizeRangeLabels}>
          <span>
            {formatPrintSize(
              isPortrait ? effectiveMinLongCm : minShortCm,
              isPortrait ? minShortCm : effectiveMinLongCm,
            )}
          </span>
          <span>
            {formatPrintSize(
              isPortrait ? effectiveMaxLongCm : maxShortCm,
              isPortrait ? maxShortCm : effectiveMaxLongCm,
            )}
          </span>
        </div>
      </div>
      {aspectLocked && (
        <p className={styles.customSizeHint}>
          Height and width are locked to this artwork&apos;s aspect ratio — change either, the
          other follows. This artwork can be printed at any size in the range above.
        </p>
      )}
    </div>
  )
}

function formatCm(value: number, step: number): string {
  if (!Number.isFinite(value) || value === 0) return ''
  const decimals = step >= 1 ? 0 : Math.ceil(-Math.log10(step))
  return value.toFixed(decimals)
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
          <Image src={option.tooltipHeaderImageUrl} alt="" width={640} height={360} sizes="320px" />
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
