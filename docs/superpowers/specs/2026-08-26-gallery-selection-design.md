# Gallery Selection — a curated /prints

**Date:** 2026-08-26
**Status:** design, awaiting review
**Ticket:** AR-140 (proposed)

## Problem

`/prints` lists every purchasable artwork, paginated 24 at a time. At three
artists and ~15 works that reads as a shop. At twenty artists it is roughly 100
works across five pages, and a gallery that presents a hundred prints with equal
weight has presented none of them. It contradicts the positioning the rest of the
commerce surface protects — the bare price with no "from", the refusal to hedge.

The gallery wants `/prints` to show **its own selection**, chosen and ordered by
the super admin. Everything else an artist wants to sell stays purchasable on
their artist page and in their exhibitions, which since AR-139 carry the edition,
the price and the Order Print CTA. That dependency is load-bearing: before
AR-139 an unselected print had no price or buy button anywhere, and this design
would have made it unbuyable.

## Decisions

Settled with the owner on 2026-08-26.

| Question                                       | Decision                                                                                                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does the full catalogue survive behind a link? | **No.** Pure selection. The catalogue view, its artist/edition filters and its pagination come off the public page.                                                                 |
| A selected work sells out                      | **It stays on the page**, marked "Sold out". A sold edition proves the editions move, and a buyer who saw it last week deserves to learn it sold rather than find it silently gone. |
| A selected work stops being for sale at all    | **Hidden from the page**, flagged in admin. No story to tell, and an Order Print button there is a dead end.                                                                        |
| Size of the selection                          | **No cap.** The admin shows counts, never blocks.                                                                                                                                   |
| Name                                           | Public page stays **Prints**. The curated concept is the **Gallery Selection**, used as a subtitle above the grid and as the admin screen's name.                                   |
| Public heading                                 | Page title and intro copy stay as they are (CMS `PageContent`, slug `prints`). A **subtitle sits immediately above the grid**.                                                      |

### Non-goals

- No rotation engine, scheduling, or automatic selection. A person chooses.
- No per-artist quota enforcement. The admin surfaces a per-artist tally so
  imbalance is visible; it does not police it.
- No change to how artist or exhibition pages list work.
- No change to pricing, edition or checkout logic.

## Data model

```prisma
model SelectedPrint {
  id        String   @id @default(uuid())
  artworkId String   @unique
  artwork   Artwork  @relation(fields: [artworkId], references: [id], onDelete: Cascade)
  order     Int      @default(0)
  createdAt DateTime @default(now())
}
```

A dedicated table, mirroring the existing `Slide` model that backs the homepage
hero — same shape, same reorder pattern. Rationale:

- `@unique` on `artworkId` makes double-adding structurally impossible.
- `onDelete: Cascade` means a deleted artwork cannot leave a ghost in the
  selection.
- Ordering lives on the selection, so reordering never writes to `Artwork`.
- `Artwork` already carries `featured` (meaning "show on my artist page") and
  `order` (library order). Adding a third flag/order pair there would rebuild the
  precise confusion this design avoids by not reusing `featured`.

Rejected: two boolean/int fields on `Artwork` (overloads a table that already has
two similar pairs, sparse ordering across a growing table); a JSON id array on
`PageContent` (no referential integrity — a deleted artwork leaves a dangling id
that fails silently).

`Artwork` gains the back-relation `selectedPrint SelectedPrint?`.

## Eligibility — one rule, one place

"Currently selling" is already defined once, in `src/lib/editions/printable.ts`
(`purchasableArtworkWhere` / `isArtworkPurchasable`) and resolved per card by
`resolveArtworkSale` in `src/lib/editions/artworkSale.ts`. This feature adds no
new definition; it consumes those.

Two conditions decide what is on the page: the work is **currently selling**, and
it is **in the selection**. "Currently selling" carries its existing meaning —
`isArtworkPurchasable`, which is TRUE for a sold-out edition, because the work is
on sale and there is simply nothing left of it. That is a different fact from
prints being switched off, and the page treats them differently.

`resolveArtworkSale` already returns three states; the cut line sits between the
second and the third:

| State        | Condition                                | On /prints                   | In admin     |
| ------------ | ---------------------------------------- | ---------------------------- | ------------ |
| On sale      | `sale.minPriceCents` is a number         | Edition, price, Order Print  | Live         |
| Sold out     | `sale` present, `minPriceCents === null` | **Stays**, marked "Sold out" | Sold out     |
| Not for sale | `resolveArtworkSale` returns `null`      | Hidden                       | Not for sale |

So the public read filters on `sale != null` — not on a price being present.
`ArtworkGrid` has rendered the "Sold out" badge for the middle case since AR-139,
so no component changes.

Showing sold-out work is deliberate commercial signal: a page where some editions
have gone tells a buyer the editions move. The cost is that an untended selection
slowly becomes a graveyard, so the admin shows a sold-out count. Judging that
ratio is the curator's job, not the code's.

## Public page — `/prints`

Unchanged: route, CMS title, intro copy, banner image.

Removed: `PrintsToolbar` (artist + edition filters), `Pagination`, and the
client-side paging in `PrintsBrowser`. The page becomes a server component that
reads the selection once and renders `ArtworkGrid`.

Added: a subtitle directly above the grid — "Gallery Selection". A fixed string
in the component, not CMS-managed: it names a permanent feature of the page
rather than editorial copy. If it should become editable it is one nullable
column on `PageContent`, but that is not built now.

```
  [ banner ]
  Prints                     ← CMS title
  [ CMS intro copy ]
  ─────────────────────
  Gallery Selection          ← new subtitle, immediately above the grid
  [ ArtworkGrid — selected works, in the admin's order ]
```

`ArtworkGrid` needs no change. It already takes `sale` per card (AR-139) and
already renders edition, price and CTA.

### Empty state

Pure selection means the page can legitimately render zero works — on day one, or
if everything selected is withdrawn from sale. Selling out no longer empties it:
those entries stay, marked. A blank grid under a
banner reads as a broken page.

When the selection resolves to no visible works, the banner, title and intro copy
still render, and the grid is replaced by one quiet line:

> New prints are being selected. In the meantime, every artist's available work
> is on their own page.

…followed by a link to `/artists`. The admin screen warns long before this, but
the page must not depend on that.

## Admin — `/admin/content/gallery-selection`

Reachable from the existing Content hub, following `/admin/content/landing`
(hero slides), which already solves the same problem: an ordered, admin-curated
list feeding a public surface.

**Guard:** super admin only. (`/admin/content/landing` admits `admin` too; this
is the gallery's own editorial voice, and the owner asked for a super-admin
tool. Enforced server-side, not only in the UI.)

The screen is the ordered selection, with an `Add artworks` button that opens a
picker over it. Curating and finding are separate jobs and separate surfaces:
the list stays short and draggable however large the catalogue behind it grows.

### The selection list

Drag-to-reorder rows via dnd-kit, exactly as `SortableSlideItem` does. Each row:
thumbnail, title, artist, edition type, current price, Remove.

A sold-out row is labelled _Sold out · shown on the page_ — visible and
deliberate, and counted in the header so a selection drifting toward a graveyard
is obvious at a glance.

A row that is not for sale at all renders greyed, labelled _Not for sale · hidden
from the page_. Either way the entry stays until the admin removes it — flag,
never silently un-curate.

Header shows the count and a per-artist tally, so "four of these are by one
artist" is visible at a glance without being blocked.

Saving order reuses the slides pattern: `POST` an ordered array of ids,
`$transaction` of index writes.

### Adding artworks — the picker

`Add artworks` opens a `Modal`, as `/admin/content/landing` already does for
editing a slide. It has two modes and they are never used together, because they
answer different questions: _what does Jane have?_ and _where is that piece
called Puerta?_

Each mode carries a text input, and the rule for it is the same in both places:
**it filters whatever list is currently below it.** Choosing from a list stops
scaling at exactly the point this whole feature exists to address — twenty
artists is a scroll, and so is one artist with forty prints.

**By artist.** The input filters the artist list; the list holds artists who own
at least one currently-selling print, alphabetical, each with a count. An artist
with nothing sellable never appears, so no row here is a dead end. Choosing one
drills into that artist's sellable prints and the same input now filters those,
with the placeholder changing to say so. A back link returns to the artist list.

**By name.** The input matches artwork title across every artist. Empty until
something is typed — no default dump of everything, which would just be the
catalogue again in a smaller box.

Both modes render the same row: a `Checkbox`, a small thumbnail beside the title,
then artist, edition type and price.

Ticks accumulate across drill-downs and across a mode switch, so several artists
can be swept in one pass. **Nothing is written until `Add N`**; Cancel discards.
On Add, the checked works go to the **TOP** of the selection, in the order shown,
and the modal closes. Top rather than bottom because a work is added in order to
be seen: appending would make every add a two-step action — add, then drag it up.
From the top the curator moves it wherever they want.

Works already in the selection are excluded from the picker — they are in the
list directly above it.

Only currently-selling works appear anywhere in the picker. A work that cannot be
added is therefore never shown rather than shown-and-disabled; the consequence,
accepted, is that "why isn't my piece here?" is answered on the artwork's own
admin page, not this one.

Thumbnails come from `imageUrl`. Never `originalImageUrl` — that is the 60+MB
print master (`feedback_never_serve_original_images`).

**Data, and where each search runs.** The two modes have genuinely different
cardinality, so they get different treatment rather than one debounced mechanism
imposed on both:

- _Artist list_ — scales with artists, not artworks, so it stays small. Fetched
  once when the modal opens and filtered in the browser: instant, no request per
  keystroke. Reuses `getPrintArtistOptions`, which already returns distinct
  artists holding at least one purchasable work sorted by display name; it gains
  a per-artist count.
- _One artist's prints_ — bounded by that artist's output. Fetched once on
  drill-in and filtered in the browser, same as above.
- _By name across all artists_ — unbounded, so this one goes to the server,
  debounced and paginated.

`getPrintsCatalogPage` already selects this exact shape and already filters to
purchasable work. It gains `search` and `excludeIds` arguments and moves from
backing the public page to backing this picker.

Controls follow the house rule: admin surfaces are rounded, and every button is
the shared `Button` component.

## API

| Route                          | Method | Purpose                                                       |
| ------------------------------ | ------ | ------------------------------------------------------------- |
| `/api/selected-prints`         | GET    | The selection, ordered, with resolved sale state (admin)      |
| `/api/selected-prints`         | POST   | Add `{ artworkIds: string[] }` — PREPENDS, in the given order |
| `/api/selected-prints/[id]`    | DELETE | Remove one                                                    |
| `/api/selected-prints/reorder` | POST   | `{ ids: string[] }` → index writes in a transaction           |

All four are super-admin guarded via `requireSuperAdmin` from `lib/authUtils`.
POST validates every id — exists, currently purchasable, not already selected —
and rejects the whole batch if any fails, so a stale picker cannot half-apply.
The UI filters to purchasable work already; this is the server saying so too,
since the picker's view of "sellable" can go stale while the modal sits open.

The public read does **not** go through the API — `/prints` is a server component
and queries directly, like the other public pages.

## Testing

Playwright, in `/e2e/`, per house rules. No WebGL involved.

Data-layer (no browser, calling the query directly — the `prints-catalog-limited`
pattern):

- the public selection returns work that is on sale OR sold out, never work that is not for sale
- a sold-out selected work is PRESENT publicly and renders a "Sold out" badge, not an Order Print button
- a print-disabled selected work is absent publicly, present in admin as "Not for sale"
- ordering follows `order`, not `createdAt`
- deleting an artwork removes its selection row (cascade)
- adding the same artwork twice fails

Browser:

- `/prints` renders the selected works, in the admin's order, with edition, price and CTA
- `/prints` with an empty selection shows the editorial line, not a blank grid
- the picker's artist mode lists only artists holding a sellable print, with counts
- typing in artist mode narrows the artist list, and narrows that artist's prints after drilling in
- drilling into an artist lists only that artist's sellable prints
- name mode matches on title, is empty before typing, and searches across artists
- ticks survive a drill-down and a mode switch; Cancel writes nothing
- `Add N` puts all checked works at the TOP, in order, and they disappear from the picker
- adding a work that stopped selling while the modal was open is rejected server-side
- Add then reorder then reload persists the order

Reuse: the existing `prints-catalog-limited.spec.ts` assertions about what counts
as purchasable stay valid and get re-pointed at the picker's query.

## Deployment

This adds a table, so the prod schema must be synced as part of the deploy — see
`feedback_prod_db_sync_before_release`. The owner applies every schema change,
to dev and to prod; Claude edits `schema.prisma` and never runs or proposes a
migration command (`feedback_never_suggest_migrate_command`).
`reference_prod_schema_census` has the read-only check for confirming the delta
first.

The selection starts empty. `/prints` will show the empty state until works are
added, so **the selection must be populated before this ships**, or the shop page
is empty in production. This is the one ordering constraint in the rollout.

## Risks

- **Discoverability.** Unselected prints are reachable only from artist and
  exhibition pages. Accepted deliberately; AR-139 made those pages sell.
- **SEO.** `/prints` stops linking to most purchasable works. Internal links from
  artist and exhibition pages remain the crawl path. Worth watching in Search
  Console after release; not a blocker.
- **Artist expectations.** Some artists will never appear on `/prints`. The
  owner's answer is that artists sell from their own pages. The per-artist tally
  in the admin exists so imbalance is at least visible to the curator.
