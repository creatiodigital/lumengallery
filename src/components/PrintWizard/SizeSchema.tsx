'use client'

import styles from './PrintWizard.module.scss'

interface SizeSchemaProps {
  printWidthCm: number
  printHeightCm: number
  moldingWidthCm: number
  moldingColorHex: string
  mattingBorderCm: number
  mattingColorHex: string
  showFrame: boolean
  /** Artwork preview URL. When provided, fills the print rect (image
   *  = the buyer's typed print size, matching the 3D scene). */
  imageUrl?: string
  /** Uniform white paper border on every side of the printed image,
   *  in cm. Rendered as a WHITE sheet layer OUTSIDE the image — the
   *  buyer's print size is the image, the paper sheet is bigger. */
  paperBorderCm?: number
  /** Floating-frame only: visible backboard border extending past the
   *  paper sheet on every side, in cm. Rendered as a coloured layer
   *  between the paper and the frame so the schema differentiates
   *  Floating from Standard (which has a passepartout instead). */
  backboardBorderCm?: number
  backboardColorHex?: string
}

/**
 * Live SVG diagram that mirrors gallery-style "image + paper + mat +
 * frame" measurements panel. Matches the 3D preview's convention:
 * the buyer's typed print size IS the image; the paper sheet, any
 * passepartout, and the moulding stack outward from it.
 *
 * Layer stack (innermost → outermost):
 *   image (print rect) → paper border → matting → frame
 *
 * Axis labels show cm only — the dual-format "cm (in)" spell-out
 * lives in the measurement list beside the diagram.
 */
export const SizeSchema = ({
  printWidthCm,
  printHeightCm,
  moldingWidthCm,
  moldingColorHex,
  mattingBorderCm,
  mattingColorHex,
  showFrame,
  imageUrl,
  paperBorderCm = 0,
  backboardBorderCm = 0,
  backboardColorHex = '#f6f3ec',
}: SizeSchemaProps) => {
  const effectivePaperBorder = Math.max(paperBorderCm, 0)
  const effectiveMatting = showFrame ? mattingBorderCm : 0
  const effectiveFrame = showFrame ? moldingWidthCm : 0
  const effectiveBackboard = showFrame ? Math.max(backboardBorderCm, 0) : 0

  const paperWidthCm = printWidthCm + effectivePaperBorder * 2
  const paperHeightCm = printHeightCm + effectivePaperBorder * 2
  // Floating frame: backboard sits between the paper and the moulding.
  // Standard frame: backboard is 0, mat takes its place.
  const backboardWidthCm = paperWidthCm + effectiveBackboard * 2
  const backboardHeightCm = paperHeightCm + effectiveBackboard * 2
  const matWidthCm = backboardWidthCm + effectiveMatting * 2
  const matHeightCm = backboardHeightCm + effectiveMatting * 2
  const overallWidthCm = matWidthCm + effectiveFrame * 2
  const overallHeightCm = matHeightCm + effectiveFrame * 2

  // Match the size-input precision (0.1 cm step): show one decimal
  // when the value isn't a whole cm, otherwise drop the trailing .0.
  // Keeps "22 cm" tidy and "22.4 cm" honest.
  const formatDim = (cm: number) => `${Number.isInteger(cm) ? cm : cm.toFixed(1)} cm`

  // Square viewBox so portrait and landscape renders get the same visual
  // budget. Scaling by the *longest* side means a 30×20 print looks the
  // same physical size whether hung portrait or landscape — flipping only
  // rotates the rectangle, never shrinks it.
  const VIEWBOX_W = 280
  const VIEWBOX_H = 280
  const PADDING = 32
  const availableW = VIEWBOX_W - PADDING * 2
  const availableH = VIEWBOX_H - PADDING * 2

  // Each border layer is rendered at its real proportional scale so
  // the diagram matches what the 3D shows. A small floor (3 px) keeps
  // very thin layers from disappearing on huge prints without
  // dominating the visual at small ones.
  const MIN_FRAME_PX = 3
  const MIN_MAT_PX = 3
  const MIN_PAPER_PX = 3
  const MIN_BACKBOARD_PX = 3
  const rawScale = Math.min(availableW, availableH) / Math.max(overallWidthCm, overallHeightCm)
  const frameW = effectiveFrame > 0 ? Math.max(effectiveFrame * rawScale, MIN_FRAME_PX) : 0
  const matBorderW = effectiveMatting > 0 ? Math.max(effectiveMatting * rawScale, MIN_MAT_PX) : 0
  const backboardW =
    effectiveBackboard > 0 ? Math.max(effectiveBackboard * rawScale, MIN_BACKBOARD_PX) : 0
  const paperBorderW =
    effectivePaperBorder > 0 ? Math.max(effectivePaperBorder * rawScale, MIN_PAPER_PX) : 0

  // Re-fit the print (image) so the exaggerated borders still leave room
  // inside the viewBox. The image itself stays proportional to real
  // dimensions, only the surrounding layers are nudged up to a min size.
  const borderPx = (frameW + matBorderW + backboardW + paperBorderW) * 2
  const longestPrintCm = Math.max(printWidthCm, printHeightCm)
  const printScale = (Math.min(availableW, availableH) - borderPx) / longestPrintCm
  const printW = printWidthCm * printScale
  const printH = printHeightCm * printScale
  const paperW = printW + paperBorderW * 2
  const paperH = printH + paperBorderW * 2
  const backboardSchemaW = paperW + backboardW * 2
  const backboardSchemaH = paperH + backboardW * 2
  const matW = backboardSchemaW + matBorderW * 2
  const matH = backboardSchemaH + matBorderW * 2
  const outerW = matW + frameW * 2
  const outerH = matH + frameW * 2

  // Center everything
  const outerX = (VIEWBOX_W - outerW) / 2
  const outerY = (VIEWBOX_H - outerH) / 2
  const matX = outerX + frameW
  const matY = outerY + frameW
  const backboardX = matX + matBorderW
  const backboardY = matY + matBorderW
  const paperX = backboardX + backboardW
  const paperY = backboardY + backboardW
  const printX = paperX + paperBorderW
  const printY = paperY + paperBorderW

  // "Outer" arrows are shown when any layer surrounds the image — frame,
  // mat, backboard, or paper border. Otherwise the diagram is just the
  // bare image.
  const hasOuter =
    showFrame ||
    effectiveMatting > 0 ||
    effectiveBackboard > 0 ||
    effectivePaperBorder > 0

  return (
    <div className={styles.schemaWrapper}>
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        className={styles.schemaSvg}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Frame — rendered in the selected molding color. */}
        {showFrame && (
          <rect
            x={outerX}
            y={outerY}
            width={outerW}
            height={outerH}
            fill={moldingColorHex}
            rx={1}
          />
        )}

        {/* Mat (passepartout) */}
        {showFrame && effectiveMatting > 0 && (
          <rect x={matX} y={matY} width={matW} height={matH} fill={mattingColorHex} />
        )}

        {/* Backboard (Floating frames only). Coloured sheet that
            extends past the paper on every side, behind the print. */}
        {effectiveBackboard > 0 && (
          <rect
            x={backboardX}
            y={backboardY}
            width={backboardSchemaW}
            height={backboardSchemaH}
            fill={backboardColorHex}
            stroke="#d0d0d0"
            strokeWidth={0.5}
          />
        )}

        {/* Paper sheet — white border extending around the image. Visible
            when paperBorderCm > 0. A thin stroke shows the sheet boundary
            when nothing else is around it. */}
        {effectivePaperBorder > 0 && (
          <rect
            x={paperX}
            y={paperY}
            width={paperW}
            height={paperH}
            fill="#ffffff"
            stroke={showFrame || effectiveMatting > 0 ? 'none' : '#d0d0d0'}
            strokeWidth={0.5}
          />
        )}

        {/* Print rect — fills with white as a fallback; the image draws
            on top of this. Stroke only when nothing else outlines it. */}
        <rect
          x={printX}
          y={printY}
          width={printW}
          height={printH}
          fill="#ffffff"
          stroke={hasOuter ? 'none' : '#d0d0d0'}
          strokeWidth={0.5}
        />

        {/* Artwork image filling the print rect. Aspect is preserved;
            the print rect is already aspect-locked to the artwork so
            there should be no letterboxing. */}
        {imageUrl && printW > 0 && printH > 0 && (
          <image
            href={imageUrl}
            x={printX}
            y={printY}
            width={printW}
            height={printH}
            preserveAspectRatio="xMidYMid meet"
          />
        )}

        {/* ── Outer width label (top) ─────────────────────────── */}
        {hasOuter && (
          <>
            <line
              x1={outerX}
              y1={outerY - 18}
              x2={outerX + outerW}
              y2={outerY - 18}
              stroke="#9a9a9a"
              strokeWidth={0.5}
              markerStart="url(#arrowStart)"
              markerEnd="url(#arrowEnd)"
            />
            <text
              x={outerX + outerW / 2}
              y={outerY - 24}
              textAnchor="middle"
              className={styles.schemaLabel}
            >
              {formatDim(overallWidthCm)}
            </text>
          </>
        )}

        {/* ── Print width label (below the whole frame) ───────── */}
        <line
          x1={printX}
          y1={outerY + outerH + 12}
          x2={printX + printW}
          y2={outerY + outerH + 12}
          stroke="#9a9a9a"
          strokeWidth={0.5}
          markerStart="url(#arrowStart)"
          markerEnd="url(#arrowEnd)"
        />
        <text
          x={printX + printW / 2}
          y={outerY + outerH + 24}
          textAnchor="middle"
          className={styles.schemaLabel}
        >
          {formatDim(printWidthCm)}
        </text>

        {/* ── Outer height label (right) ──────────────────────── */}
        {hasOuter && (
          <>
            <line
              x1={outerX + outerW + 22}
              y1={outerY}
              x2={outerX + outerW + 22}
              y2={outerY + outerH}
              stroke="#9a9a9a"
              strokeWidth={0.5}
              markerStart="url(#arrowStart)"
              markerEnd="url(#arrowEnd)"
            />
            <text
              x={outerX + outerW + 28}
              y={outerY + outerH / 2}
              textAnchor="start"
              dominantBaseline="middle"
              className={styles.schemaLabel}
            >
              {formatDim(overallHeightCm)}
            </text>
          </>
        )}

        {/* ── Print height label (left of the whole frame) ────── */}
        <line
          x1={outerX - 12}
          y1={printY}
          x2={outerX - 12}
          y2={printY + printH}
          stroke="#9a9a9a"
          strokeWidth={0.5}
          markerStart="url(#arrowStart)"
          markerEnd="url(#arrowEnd)"
        />
        <text
          x={outerX - 18}
          y={printY + printH / 2}
          textAnchor="end"
          dominantBaseline="middle"
          className={styles.schemaLabel}
        >
          {formatDim(printHeightCm)}
        </text>

        {/* Arrow markers */}
        <defs>
          <marker
            id="arrowStart"
            viewBox="0 0 10 10"
            refX="0"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 10 0 L 0 5 L 10 10 z" fill="#9a9a9a" />
          </marker>
          <marker
            id="arrowEnd"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9a9a9a" />
          </marker>
        </defs>
      </svg>
    </div>
  )
}
