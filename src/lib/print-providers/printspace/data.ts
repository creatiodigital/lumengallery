/**
 * The Print Space catalog data. Built up incrementally as the user
 * supplies each section's vocabulary. Only the dimensions filled in
 * here render in the wizard — anything not listed simply doesn't exist
 * for TPS yet.
 *
 * Names match TPS's exact UI wording so the admin can copy/paste them
 * straight into TPS's order portal during manual fulfillment.
 */

// ── Print Type (top-level cascade) ───────────────────────────
//
// Two main categories. Each has its own paper list — the buyer picks
// the print type first, then sees only that type's papers.

export type TpsPrintTypeId = 'giclee' | 'ctype'

export type TpsPrintType = {
  id: TpsPrintTypeId
  label: string
  description: string
}

export const TPS_PRINT_TYPES: TpsPrintType[] = [
  {
    id: 'giclee',
    label: 'Giclée',
    description:
      'Pigment ink fine-art printing on heavyweight cotton, alpha-cellulose and hybrid papers. Long-life archival inks suited to gallery-grade reproduction.',
  },
  {
    id: 'ctype',
    label: 'C-Type',
    description:
      'Photographic chromogenic prints exposed onto light-sensitive paper and developed in liquid chemistry. Continuous-tone, deep-saturation finish.',
  },
]

// ── Papers (gated by print type) ─────────────────────────────

export type TpsPaperId =
  // Giclée papers
  | 'hahnemuhle-german-etching'
  | 'hahnemuhle-pearl'
  | 'canson-baryta-gloss'
  | 'ilford-cotton-textured'
  | 'hahnemuhle-bamboo'
  | 'hahnemuhle-photo-rag'
  | 'epson-semi-gloss'
  // C-Type papers
  | 'fuji-matt'
  | 'fuji-gloss'

export type TpsPaper = {
  id: TpsPaperId
  label: string
  description: string
  /** Which print-type this paper belongs to. Drives the cascading filter. */
  printType: TpsPrintTypeId
  /** Paper roughness for the 3D preview (0 = mirror-glossy, 1 = full matte). */
  paperRoughness: number
}

export const TPS_PAPERS: TpsPaper[] = [
  // Giclée — 7 options
  {
    id: 'hahnemuhle-german-etching',
    label: 'Hahnemühle German Etching',
    description:
      'Heavily textured mould-made fine-art paper with pronounced tooth and warm-white tone. Favoured for black-and-white and painterly work where surface character matters.',
    printType: 'giclee',
    paperRoughness: 0.92,
  },
  {
    id: 'hahnemuhle-pearl',
    label: 'Hahnemühle Pearl',
    description:
      'Smooth pearl-finish photo rag with a subtle sheen. Sits between matte and gloss — preserves shadow detail while keeping highlights bright.',
    printType: 'giclee',
    paperRoughness: 0.55,
  },
  {
    id: 'canson-baryta-gloss',
    label: 'Canson Baryta Gloss',
    description:
      'Bright-white, gloss baryta with a true silver-gelatin look. The collector standard for high-contrast photographic reproduction.',
    printType: 'giclee',
    paperRoughness: 0.3,
  },
  {
    id: 'ilford-cotton-textured',
    label: 'Ilford Cotton Textured',
    description:
      '100% cotton, lightly textured surface. Soft tonal transitions and excellent dynamic range for both monochrome and colour work.',
    printType: 'giclee',
    paperRoughness: 0.85,
  },
  {
    id: 'hahnemuhle-bamboo',
    label: 'Hahnemühle Bamboo',
    description:
      'Sustainable bamboo-fibre fine-art paper with a warm white base and a smooth, slightly textured surface. Distinctive natural character.',
    printType: 'giclee',
    paperRoughness: 0.8,
  },
  {
    id: 'hahnemuhle-photo-rag',
    label: 'Hahnemühle Photo Rag',
    description:
      '100% cotton, archival museum cotton rag. Smooth matte surface with deep blacks and accurate colour — the everyday gallery-grade choice.',
    printType: 'giclee',
    paperRoughness: 0.85,
  },
  {
    id: 'epson-semi-gloss',
    label: 'Epson Semi-Gloss',
    description:
      'Resin-coated semi-gloss with a wide colour gamut. Less expensive than fine-art papers; durable and well-suited to vibrant photographic work.',
    printType: 'giclee',
    paperRoughness: 0.45,
  },

  // C-Type — 2 options
  {
    id: 'fuji-matt',
    label: 'Fuji Matt',
    description:
      'Chromogenic matte photographic paper. Soft, glare-free finish ideal for portrait and editorial work that needs to hang under varied lighting.',
    printType: 'ctype',
    paperRoughness: 0.75,
  },
  {
    id: 'fuji-gloss',
    label: 'Fuji Gloss',
    description:
      'Chromogenic gloss photographic paper. Saturated, punchy colour with a reflective surface — best behind glazing or in controlled lighting.',
    printType: 'ctype',
    paperRoughness: 0.2,
  },
]

// ── Format / Framing ─────────────────────────────────────────
//
// TPS calls this "Mounting / Framing" but we deliberately do NOT
// offer the Mounting variant — only Print Only and Framing. When
// Framing is picked, downstream dimensions (Frame Type and its
// dependent material/colour options) become visible via
// `visibleWhen`.
export type TpsFormatId = 'print-only' | 'framing'

export type TpsFormat = {
  id: TpsFormatId
  label: string
  description: string
  framed: boolean
}

export const TPS_FORMATS: TpsFormat[] = [
  {
    id: 'print-only',
    label: 'Print Only',
    description:
      'Just the print itself, on the chosen paper. Delivered flat or rolled depending on size.',
    framed: false,
  },
  {
    id: 'framing',
    label: 'Framing',
    description:
      'Print delivered ready to hang in a TPS frame. Pick the frame type, material and finish in the next steps.',
    framed: true,
  },
]

// ── Frame Type (only when Format = Framing) ──────────────────
//
// TPS offers four frame types. All four are wired: Standard, Box,
// Floating, Tray. Tray is the only one without glass — open-faced,
// Dibond-mounted print sits slightly recessed inside the moulding.
export type TpsFrameTypeId = 'standard' | 'box' | 'floating' | 'tray'

export type TpsFrameType = {
  id: TpsFrameTypeId
  label: string
  description: string
  /** Full-width helper illustration shown at the top of the option's
   *  tooltip popup in the wizard. */
  helperImageUrl?: string
}

export const TPS_FRAME_TYPES: TpsFrameType[] = [
  {
    id: 'standard',
    label: 'Standard Frame',
    description: 'Classic moulding-and-glazing frame. Pick a colour and profile in the next step.',
    helperImageUrl: '/assets/helpers/classic.jpg',
  },
  {
    id: 'box',
    label: 'Box Frame',
    description:
      'Deeper frame with the print recessed inside. Modern, contemporary look — pick the moulding next.',
    helperImageUrl: '/assets/helpers/box.jpg',
  },
  {
    id: 'floating',
    label: 'Floating Frame',
    description:
      'The print appears suspended within the frame with a small visible gap on each side. Gallery-style presentation.',
    helperImageUrl: '/assets/helpers/floating.jpg',
  },
  {
    id: 'tray',
    label: 'Tray Frame',
    description:
      'Open frame, no glass. Your Dibond-mounted print sits slightly recessed below the moulding edge for a minimal, contemporary look.',
    helperImageUrl: '/assets/helpers/tray-v2.jpg',
  },
]

// ── Moulding (depends on Frame Type) ─────────────────────────
//
// Standard Frame has 9 mouldings = 3 colours × 3 profiles each, with
// minor variations (Oak swaps "Square" for "Thin Rounded"). Other
// frame types' mouldings get added when supplied.
export type TpsMouldingId =
  // Standard Frame — 22 options
  | 'std-white-thin'
  | 'std-white-wide'
  | 'std-white-square'
  | 'std-black-thin'
  | 'std-black-wide'
  | 'std-black-square'
  | 'std-oak-thin'
  | 'std-oak-wide'
  | 'std-oak-thin-rounded'
  | 'std-oak-wide-rounded'
  | 'std-walnut-thin'
  | 'std-walnut-wide'
  | 'std-walnut-square'
  | 'std-beech-thin'
  | 'std-beech-wide'
  | 'std-beech-square'
  | 'std-silver-thin'
  | 'std-silver-wide'
  | 'std-gold-thin'
  | 'std-gold-wide'
  | 'std-ornate-gold-small'
  | 'std-ornate-gold-large'
  // Box Frame — 6 options
  | 'box-white-thin'
  | 'box-white-square'
  | 'box-black-thin'
  | 'box-black-square'
  | 'box-oak-thin'
  | 'box-oak-thin-rounded'
  // Floating Frame — 6 options
  | 'flt-white-thin'
  | 'flt-white-square'
  | 'flt-black-thin'
  | 'flt-black-square'
  | 'flt-oak-thin'
  | 'flt-oak-thin-rounded'
  // Tray Frame — 4 options (TPS only sells one profile, varying colour)
  | 'tray-beech'
  | 'tray-white'
  | 'tray-black'
  | 'tray-walnut'

export type TpsMoulding = {
  id: TpsMouldingId
  label: string
  /** Which frame type this moulding belongs to — drives the cascade. */
  frameType: TpsFrameTypeId
  /** Hex used for the 3D preview's frame material. */
  hex: string
  /** Material roughness for the 3D preview (0 = mirror, 1 = matte). */
  roughness: number
}

export const TPS_MOULDINGS: TpsMoulding[] = [
  // White
  {
    id: 'std-white-thin',
    label: 'White — Thin',
    frameType: 'standard',
    hex: '#f2f2f2',
    roughness: 0.55,
  },
  {
    id: 'std-white-wide',
    label: 'White — Wide',
    frameType: 'standard',
    hex: '#f2f2f2',
    roughness: 0.55,
  },
  {
    id: 'std-white-square',
    label: 'White — Square',
    frameType: 'standard',
    hex: '#f2f2f2',
    roughness: 0.55,
  },
  // Black
  {
    id: 'std-black-thin',
    label: 'Black — Thin',
    frameType: 'standard',
    hex: '#0b0b0b',
    roughness: 0.35,
  },
  {
    id: 'std-black-wide',
    label: 'Black — Wide',
    frameType: 'standard',
    hex: '#0b0b0b',
    roughness: 0.35,
  },
  {
    id: 'std-black-square',
    label: 'Black — Square',
    frameType: 'standard',
    hex: '#0b0b0b',
    roughness: 0.35,
  },
  // Oak
  {
    id: 'std-oak-thin',
    label: 'Oak — Thin',
    frameType: 'standard',
    hex: '#c8a27a',
    roughness: 0.7,
  },
  {
    id: 'std-oak-wide',
    label: 'Oak — Wide',
    frameType: 'standard',
    hex: '#c8a27a',
    roughness: 0.7,
  },
  {
    id: 'std-oak-thin-rounded',
    label: 'Oak — Thin Rounded',
    frameType: 'standard',
    hex: '#c8a27a',
    roughness: 0.7,
  },
  {
    id: 'std-oak-wide-rounded',
    label: 'Oak — Wide Rounded',
    frameType: 'standard',
    hex: '#c8a27a',
    roughness: 0.7,
  },
  // Walnut
  {
    id: 'std-walnut-thin',
    label: 'Walnut — Thin',
    frameType: 'standard',
    hex: '#5a3b28',
    roughness: 0.7,
  },
  {
    id: 'std-walnut-wide',
    label: 'Walnut — Wide',
    frameType: 'standard',
    hex: '#5a3b28',
    roughness: 0.7,
  },
  {
    id: 'std-walnut-square',
    label: 'Walnut — Square',
    frameType: 'standard',
    hex: '#5a3b28',
    roughness: 0.7,
  },
  // Beech
  {
    id: 'std-beech-thin',
    label: 'Beech — Thin',
    frameType: 'standard',
    hex: '#d8b986',
    roughness: 0.7,
  },
  {
    id: 'std-beech-wide',
    label: 'Beech — Wide',
    frameType: 'standard',
    hex: '#d8b986',
    roughness: 0.7,
  },
  {
    id: 'std-beech-square',
    label: 'Beech — Square',
    frameType: 'standard',
    hex: '#d8b986',
    roughness: 0.7,
  },
  // Silver
  {
    id: 'std-silver-thin',
    label: 'Silver — Thin',
    frameType: 'standard',
    hex: '#c0c0c0',
    roughness: 0.4,
  },
  {
    id: 'std-silver-wide',
    label: 'Silver — Wide',
    frameType: 'standard',
    hex: '#c0c0c0',
    roughness: 0.4,
  },
  // Gold
  {
    id: 'std-gold-thin',
    label: 'Gold — Thin',
    frameType: 'standard',
    hex: '#d4af37',
    roughness: 0.35,
  },
  {
    id: 'std-gold-wide',
    label: 'Gold — Wide',
    frameType: 'standard',
    hex: '#d4af37',
    roughness: 0.35,
  },
  // Ornate (heavier decorated profiles, brighter gold)
  {
    id: 'std-ornate-gold-small',
    label: 'Ornate — Gold Small',
    frameType: 'standard',
    hex: '#e6c84a',
    roughness: 0.3,
  },
  {
    id: 'std-ornate-gold-large',
    label: 'Ornate — Gold Large',
    frameType: 'standard',
    hex: '#e6c84a',
    roughness: 0.3,
  },

  // Box Frame mouldings (6 — no "Wide", no "Square" oak)
  {
    id: 'box-white-thin',
    label: 'White — Thin',
    frameType: 'box',
    hex: '#f2f2f2',
    roughness: 0.55,
  },
  {
    id: 'box-white-square',
    label: 'White — Square',
    frameType: 'box',
    hex: '#f2f2f2',
    roughness: 0.55,
  },
  {
    id: 'box-black-thin',
    label: 'Black — Thin',
    frameType: 'box',
    hex: '#0b0b0b',
    roughness: 0.35,
  },
  {
    id: 'box-black-square',
    label: 'Black — Square',
    frameType: 'box',
    hex: '#0b0b0b',
    roughness: 0.35,
  },
  { id: 'box-oak-thin', label: 'Oak — Thin', frameType: 'box', hex: '#c8a27a', roughness: 0.7 },
  {
    id: 'box-oak-thin-rounded',
    label: 'Oak — Thin Rounded',
    frameType: 'box',
    hex: '#c8a27a',
    roughness: 0.7,
  },

  // Floating Frame mouldings (6 — same shape as Box)
  {
    id: 'flt-white-thin',
    label: 'White — Thin',
    frameType: 'floating',
    hex: '#f2f2f2',
    roughness: 0.55,
  },
  {
    id: 'flt-white-square',
    label: 'White — Square',
    frameType: 'floating',
    hex: '#f2f2f2',
    roughness: 0.55,
  },
  {
    id: 'flt-black-thin',
    label: 'Black — Thin',
    frameType: 'floating',
    hex: '#0b0b0b',
    roughness: 0.35,
  },
  {
    id: 'flt-black-square',
    label: 'Black — Square',
    frameType: 'floating',
    hex: '#0b0b0b',
    roughness: 0.35,
  },
  {
    id: 'flt-oak-thin',
    label: 'Oak — Thin',
    frameType: 'floating',
    hex: '#c8a27a',
    roughness: 0.7,
  },
  {
    id: 'flt-oak-thin-rounded',
    label: 'Oak — Thin Rounded',
    frameType: 'floating',
    hex: '#c8a27a',
    roughness: 0.7,
  },

  // Tray Frame mouldings (4 — TPS only sells the one profile per colour)
  {
    id: 'tray-beech',
    label: 'Beech',
    frameType: 'tray',
    hex: '#d8b986',
    roughness: 0.7,
  },
  {
    id: 'tray-white',
    label: 'White',
    frameType: 'tray',
    hex: '#f2f2f2',
    roughness: 0.55,
  },
  {
    id: 'tray-black',
    label: 'Black',
    frameType: 'tray',
    hex: '#0b0b0b',
    roughness: 0.35,
  },
  {
    id: 'tray-walnut',
    label: 'Walnut',
    frameType: 'tray',
    hex: '#5a3b28',
    roughness: 0.7,
  },
]

// ── Glass (only when Format = Framing) ───────────────────────
//
// Same three glass options across every frame type — no cascading
// on frame type. Visibility is gated only by the framing format.
export type TpsGlassId = 'none' | 'standard' | 'anti-reflective'

export type TpsGlass = {
  id: TpsGlassId
  label: string
  description: string
}

export const TPS_GLASS_OPTIONS: TpsGlass[] = [
  {
    id: 'none',
    label: 'None',
    description:
      'No glazing — the print is mounted directly behind the frame opening. Maximises the paper texture but offers no surface protection.',
  },
  {
    id: 'standard',
    label: 'Standard',
    description:
      'Standard glazing. Protects the print from dust, fingerprints and UV. Will reflect ambient light depending on hanging position.',
  },
  {
    id: 'anti-reflective',
    label: 'Anti Reflective Art',
    description:
      'Premium anti-reflective glazing. Near-invisible surface even under direct light — the gallery-grade choice for collectors and high-traffic spaces.',
  },
]

// ── Mount Board Size bounds ─────────────────────────────────
//
// Width of the passepartout (mat) on every side, uniform on all
// four sides. TPS's slider is discrete: increments of 3 mm from
// 0 mm up to 72 mm (= 7.2 cm). Step values: 0, 3, 6, 9, …, 72 mm.
// We model in cm internally for consistency with the rest of the
// catalog; 0.3 cm step + 7.2 cm max matches TPS's allowed values.
export const TPS_MOUNT_BOARD_BOUNDS = {
  minCm: 0,
  /** Real TPS cap: 72 mm. */
  maxCm: 7.2,
  /** Discrete 3 mm steps, expressed as cm. */
  stepCm: 0.3,
  /** Default: 0 (no mat), matching TPS's default 0-0 state. */
  defaultCm: 0,
}

// ── Window Mount / Passepartout (only when Format = Framing) ─
//
// TPS calls the passepartout "Window Mount". Seven options including
// 'none' (which means no mat between the print and the frame).
// `hex` feeds the mat colour in the 3D preview; `roughness` keeps it
// matte-board-like. When buyer picks anything other than 'none', a
// follow-up "Mount Board Size" input controls the mat width — this
// is a TODO follow-up; for now the dimension is colour-only and the
// preview will use a small default width when a colour is chosen.
export type TpsWindowMountId =
  | 'none'
  | 'off-white'
  | 'bright-white'
  | 'ivory'
  | 'cream'
  | 'black'
  | 'grey'

export type TpsWindowMount = {
  id: TpsWindowMountId
  label: string
  /** Hex used for the 3D preview's mat layer; ignored when id='none'. */
  hex: string
  /** Mat surface roughness for the preview. Matte board ≈ 0.95. */
  roughness: number
}

export const TPS_WINDOW_MOUNTS: TpsWindowMount[] = [
  { id: 'none', label: 'None', hex: '#ffffff', roughness: 0.95 },
  { id: 'off-white', label: 'Off White', hex: '#f5f1e6', roughness: 0.95 },
  { id: 'bright-white', label: 'Bright White', hex: '#ffffff', roughness: 0.92 },
  { id: 'ivory', label: 'Ivory', hex: '#f6f3ec', roughness: 0.95 },
  { id: 'cream', label: 'Cream', hex: '#f3ead2', roughness: 0.95 },
  { id: 'black', label: 'Black', hex: '#1a1a1a', roughness: 0.9 },
  { id: 'grey', label: 'Grey', hex: '#9a9a9a', roughness: 0.9 },
]

// ── Hanging Option (only when Format = Framing) ──────────────
//
// Same four options across every frame type.
export type TpsHangingId = 'none' | 'd-rings-cord' | 'mirror-plates' | 'strap-hangers'

export type TpsHanging = {
  id: TpsHangingId
  label: string
  description: string
}

export const TPS_HANGING_OPTIONS: TpsHanging[] = [
  {
    id: 'none',
    label: 'None',
    description: 'No hanging hardware — the buyer fits their own.',
  },
  {
    id: 'd-rings-cord',
    label: 'D-Rings & Cord',
    description:
      'Pre-fitted D-rings on the back with a tensioned cord. The most common, fits standard wall hooks.',
  },
  {
    id: 'mirror-plates',
    label: 'Mirror Plates',
    description:
      'Flush metal plates that screw directly into the wall. Holds the frame tight against the wall — preferred for heavier pieces.',
  },
  {
    id: 'strap-hangers',
    label: 'Strap Hangers',
    description:
      'Two heavy-duty strap hangers, one on each side. Most secure option for large or heavy frames.',
  },
]

// ── Print size ───────────────────────────────────────────────
//
// TPS sells custom sizes — buyer picks width OR height, the other
// follows from the artwork's natural aspect ratio (no crop, ever).
// Bounds correspond roughly to TPS's product range (A4 ≈ 21 cm short
// edge → A0 ≈ 119 cm long edge); pick conservative outer limits.
// `stepCm = 0.1` gives mm precision in the input.
export const TPS_SIZE_BOUNDS = {
  minCm: 10,
  maxCm: 150,
  stepCm: 0.1,
}

// ── Border (white paper around the print) ───────────────────
//
// Per-side border in cm. Distinct from passepartout (which is a
// separate mat). Common artist preference is 0–5 cm; we cap at 10 cm.
// Integer cm — sub-cm precision isn't meaningful for a paper border.
export const TPS_BORDER_BOUNDS = {
  minCm: 0,
  maxCm: 10,
  stepCm: 1,
  defaultCm: 0,
}
