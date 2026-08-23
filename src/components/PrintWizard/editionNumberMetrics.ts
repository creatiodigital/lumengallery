/**
 * Placement metrics for the limited-edition number ("1/50") that both
 * previewers pencil into the bottom paper margin — the 3D print face
 * (scene/PreviewArtwork.tsx) and the 2D measurements diagram
 * (SizeSchema.tsx). Shared so the number sits in the same spot in both
 * and the two can't drift apart.
 *
 * The em ratios below are measured from public/fonts/caveat-regular.ttf
 * (unitsPerEm 1000) — the same Caveat design next/font serves as the
 * `--font-caveat` CSS variable, so both renderers share them.
 *
 * Why ink ratios and not text anchors: a baseline and a text box say
 * nothing about where the buyer actually SEES the number. Caveat leaves
 * a lot of blank space around its glyphs, so anchoring the text box at
 * the image's edges leaves the number looking indented from the left
 * and floating too far below. These ratios turn a font size into the
 * real ink box, so the offsets the callers apply are the gaps the buyer
 * sees.
 */

/** Tallest ink above the baseline in a "N/M" label: the slash (yMax 717).
 *  Digits only reach 574, so the slash always sets the top edge. */
export const EDITION_INK_TOP_EM = 0.717

/** Deepest ink below the baseline: the slash again (yMin -95). */
export const EDITION_INK_BOTTOM_EM = 0.095

/** Full ink height of a "N/M" label, as a fraction of the font size. */
export const EDITION_INK_HEIGHT_EM = EDITION_INK_TOP_EM + EDITION_INK_BOTTOM_EM

/**
 * Em size of the pencilled number: a roughly constant PHYSICAL size, so
 * it reads like a hand-written number rather than scaling with the print.
 * ~2.2 cm em ≈ 1.2 cm digits (see EDITION_INK_TOP_EM). Callers shrink it
 * when the paper border is too thin to hold it, and nothing else.
 */
export const EDITION_NUMBER_FONT_SIZE_CM = 2.2

/**
 * Tiny clearance between the image's bottom edge and the top of the ink —
 * just enough that the number reads as sitting right under the print
 * without touching it. The ONLY absolute term in the vertical offset;
 * everything else scales with the font size, which is itself capped to a
 * fraction of the border. Callers clamp it to whatever the border has
 * left after the ink, so the number can never spill past the sheet edge.
 */
export const EDITION_NUMBER_CLEARANCE_CM = 0.3

/** Left side bearing of each digit (glyph xMin / unitsPerEm): the blank
 *  space Caveat carries before the ink starts. 12–21% of an em — enough
 *  that anchoring the text box at the image's left edge reads as a visible
 *  indent rather than as flush. */
const EDITION_DIGIT_LEFT_BEARING_EM: Record<string, number> = {
  '0': 0.138,
  '1': 0.162,
  '2': 0.119,
  '3': 0.143,
  '4': 0.182,
  '5': 0.129,
  '6': 0.117,
  '7': 0.181,
  '8': 0.123,
  '9': 0.208,
}

/**
 * Blank space before the label's first glyph, as a fraction of the font
 * size. Subtract it from the intended left edge so the INK lines up flush
 * with the image's left edge instead of sitting indented by the bearing.
 *
 * A leading character we have no measurement for returns 0 — that label
 * falls back to plain text-box anchoring rather than being nudged by a
 * guessed amount.
 */
export const editionLeftBearingEm = (label: string): number =>
  EDITION_DIGIT_LEFT_BEARING_EM[label.trim().charAt(0)] ?? 0
