# Artwork Page — Design

**Date:** 2026-08-27
**Status:** agreed, partly built

## Goal

Make the artwork page the single door to checkout, and make it convincing enough
that a buyer knows exactly what they are getting before they reach the wizard.

Three goals, in the owner's words:

1. Clean up the artwork grid and the print page
2. Show details so the buyer knows exactly what he gets
3. Add eye-catching imagery that convinces

## Governing rule

Where the owner's mockups and the earlier PDF spec disagree, **the mockups win**.

## Decided — not to be reopened

- **No soft-reserve, no holds, no timers.** The hold layer was deleted on
  2026-08-21 (−1012 lines) and stock is decided at payment. The plain-language
  caveat on the card is the whole mitigation.
- **No accounts, no price-gating.** Buyers purchase once or twice; a login is
  friction with no payoff and a support burden for a solo operator.
- **The invoice does not carry the edition number.** The number is printed into
  the print's margin and recorded on the certificate; the buyer physically owns
  it.
- **The exhibition modal keeps its current layout.** `ArtworkDetailBody` serves
  both the page and the in-exhibition modal; the new full-width zones are
  page-only.

## Zone 1 — Core (always rendered)

Two columns: metadata left, artwork image right.

Artist · title + year · technique · dimensions · Enquire · Share · image.

This is the entire page for a work that is not for sale. Every field is already
in the database and already renders today.

`dimensions` describes the ORIGINAL, not the sheet the buyer receives. On a page
with a Buy button that is a live misreading risk and should be labelled.

## Zone 2 — Commerce (only when for sale)

Rendered in **two** places, because two requirements conflicted: the price must
be above the fold, and the explanation needs room.

### 2a. Compact card, left column, above the fold

```
AVAILABLE FOR PURCHASE
€1,800   LIMITED EDITION
Edition 50x40 Baryta · 1 of 30
Not reserved until you pay — another collector may take it first.
[ → Buy this edition ]
Certificate of authenticity · ships worldwide
```

- Price is `minimumPrice.ts` — open: smallest printable size, unframed; limited:
  cheapest live variant. It already returns the producing size and variant name.
- The card describes **one configuration** — the one the price belongs to — so
  price and edition never describe different objects.
- The "not reserved" sentence is **limited-only**. On an open edition nothing can
  be taken first and the line is simply untrue.
- Sold out keeps the card: `SOLD OUT` replaces the eyebrow, price stays, no button.
- Enquire moves **below** the card when the work is for sale, and the left column
  is sticky — together these lift the button from ~850px to ~700px, above the
  fold on a 13" laptop.

### 2b. Full-width band, below the image

Centred. Price, edition type, free-text copy, the black CTA, then the variant
list and the supporting imagery.

**Variant list** — name and number only, as typography rather than a table:

```
Edition 50x40 Baryta        1 of 30
Edition 60x50 Baryta        4 of 23
Edition 70x60 Baryta        Sold out
```

The literal word `Edition` prefixes the variant name; the count carries no word
at all.

**The number is the copy the buyer is ABOUT TO GET, not the last one sold.** It
reads forward: "this one becomes yours." With nothing sold it is `1 of 30`;
`0 of 30` is never shown.

- The first figure is `MIN(number)` over `EditionNumber` rows still `available`
  for that variant — the copy that would actually be allocated next. NOT
  `MAX(sold) + 1`: a cancelled order returns its number to the pool, so the two
  diverge and only the minimum available is the number the buyer really gets.
- No available numbers → `Sold out` in place of the count.
- Two visitors can see the same number at once; whoever pays first takes it. The
  card's "not reserved until you pay" line is exactly the disclaimer that makes
  this honest. This is NOT a reason to reintroduce holds — see the decided list.
- Only `published` variants, via the existing `LIVE_VARIANT_WHERE`.
- Variant names are free text and already encode size and paper ("50x40 Baryta"),
  so `Edition` plus the name plus the number is complete information. They should follow the house
  height × width convention.

**Free-text copy** — two admin-editable `PageContent` rows,
`artwork-purchase-info-open` and `artwork-purchase-info-limited`, edited at
`/admin/content/[slug]`. No new model, no new admin UI, no new security surface.
Open and limited need different explanations: open varies by size and framing,
limited varies by availability. Seed copy uses "Ships worldwide **normally**
within 10 business days" — an expectation, not a guarantee.

## Zone 3 — Story and imagery (only when data exists)

- **Story**: the existing `description` field, full width, serif, at reading measure.
- **Imagery**, by count: 0 → zone absent · 1 → single centred · 2 → side by side ·
  3+ → **infinite** carousel with peeking neighbours. Small viewports never get a
  carousel — the assets stack vertically.
- `object-fit: cover`, **one aspect ratio (3:2)** across all three layouts, because
  an asset moves between layouts as more are added and a shared ratio keeps the
  crop stable. The main artwork image stays `contain` and must never crop.
- **Video**: autoplay, looping, muted (browsers refuse unmuted autoplay),
  `playsInline` or iOS goes fullscreen, with a circular play/pause control top
  right. No autoplay under `prefers-reduced-motion`.

## Optionality — the hard requirement

**Nothing unfilled ever renders.** No empty headings, no dividers, no
placeholders. The dashed boxes in the mockups are design placeholders, not empty
states. Metadata will be added by hand over months; a bare artwork is the normal
case, not a degraded one.

Proven by `e2e/artwork-page-degradation.spec.ts`, written before any rich case.

## Data model

```prisma
model ArtworkMedia {
  id        String   @id @default(uuid())
  artworkId String
  artwork   Artwork  @relation(fields: [artworkId], references: [id], onDelete: Cascade)
  kind      String   // "image" | "video"
  url       String
  width     Int?
  height    Int?
  caption   String?
  order     Int      @default(0)
  createdAt DateTime @default(now())

  @@index([artworkId, order])
}
```

One table, not two, because images and video share a single ordered sequence.
Additive, no fixed count. Schema push is the owner's to run.

## Admin

Upload, replace, remove, reorder — the same affordances as the main picture,
reusing the existing presigned `/api/upload/image` and `/api/upload/video`.

**Admin-only.** The artwork is the artist's; the sales presentation is the
gallery's. Stricter than the main image, which stays artist-or-admin, and one
predicate to relax later.

## Storage — the pixelation trap

`processImage` resizes to 2048px and loops WebP quality down until under 1MB.
Correct for the main image, wrong for a print-detail close-up: a full-width slot
needs ~2800px on retina, and paper grain is the worst case for WebP, so the
quality loop bites hardest on the image whose whole job is showing texture.

Supplementary media gets its own preset: **3200px, ~2.5MB, higher minimum quality.**

### Minimum sizes

| Asset                 | Reject below     | Recommended |
| --------------------- | ---------------- | ----------- |
| Supplementary image   | 2000px long edge | 3000–4000px |
| Print detail close-up | 2400px           | 4000px      |
| Video                 | 1280×720         | 1920×1080   |

Above ~4500px is wasted. The floor doubles as a quality gate for the owner, who
uploads everything himself.

### Caps

Image 25MB (JPEG/PNG/WebP) · video 20MB (MP4/WebM, ≤30s) · 24 assets per
artwork, at most 2 video · 40 presigns per user per hour.

## Security

Inherited from `/api/upload/image`, which is a strong template: auth, ownership
checked on **both** presign and complete, MIME allowlist, declared **and** real
size via HeadObject, a key regex bound to the specific `artworkId`, no
client-supplied URLs anywhere (SSRF and image-substitution defence), magic-byte
validation, upload-before-delete ordering, generic error responses.

Three gaps to close:

1. **Video has no magic-byte check.** The image route validates bytes; the video
   route trusts the declared content-type. HTML declared `video/mp4` would land
   on the public R2 domain. Validate `ftyp` (MP4) and EBML (WebM).
2. **Neither upload route is rate-limited.** Wire the existing `RateLimit` model.
3. **Delete takes a media row id, never a key or URL.** Server loads the row,
   checks the owning artwork against the session, deletes using the URL stored in
   the row. No client-controlled string reaches R2. This keeps the feature
   narrower than the open "any signed-in user deletes any R2 object" finding.

Captions are plain escaped text, never HTML. R2's bucket is public: every asset
is world-readable by URL whether or not the artwork is published.

## Already built (uncommitted)

- **Grid cards** stripped to image · artist · title + year · Order Print · Sold
  out. Technique, dimensions, the edition tag and the dead
  `SHOW_PRICE_ON_LISTINGS` branch removed. The CTA routes to `/artworks/[slug]`,
  never to the wizard — one door. One component serves /prints, exhibition and
  artist pages. 58 gallery specs pass.
- **Degradation test** for the bare artwork page.

## Open questions

- Captions: the field exists and renders when non-empty; nothing to decide until
  one is written.
- VAT display. `minimumPrice` excludes shipping and VAT. Above a Buy button that
  figure reads as the price the buyer pays, and an EU buyer is charged 21% more.
  Not blocking, but sharper here than it was on a listing grid.
