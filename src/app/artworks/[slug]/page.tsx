import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArtworkDetailPage } from '@/components/artwork/detail'
import type { ArtworkNeighbours } from '@/components/artwork/detail/ArtworkDetailBody'
import { getArtworkMedia } from '@/lib/artwork/artworkMedia'
import { getPublicExhibitionByUrl } from '@/lib/queries/getPublicExhibitionByUrl'
import { getGallerySelection } from '@/lib/queries/getGallerySelection'
import { getPublicArtistByHandler } from '@/lib/queries/getPublicArtistByHandler'
import { buildArtworkCommerce, COMMERCE_SELECT } from '@/lib/editions/artworkCommerce'
import { LIVE_VARIANT_WHERE } from '@/lib/editions/printable'
import prisma from '@/lib/prisma'

// Render per request and read straight from the DB so artwork edits appear
// immediately. No data cache.
export const dynamic = 'force-dynamic'

const getArtwork = (slug: string) =>
  prisma.artwork.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      title: true,
      author: true,
      year: true,
      technique: true,
      dimensions: true,
      description: true,
      imageUrl: true,
      originalWidth: true,
      originalHeight: true,
      printEnabled: true,
      printPriceCents: true,
      editionType: true,
      // Live variants only — a published-but-unblocked variant is paused from
      // sale and would refuse the reservation. Selected rather than counted so
      // the shape is the same one LIVE_VARIANT_WHERE guards everywhere else.
      // SALE_SELECT's own sub-select carries what `saleFromRow` needs to cost
      // the cheapest purchasable configuration; `id` rides along for the
      // remaining-numbers count below.
      limitedVariants: {
        where: LIVE_VARIANT_WHERE,
        select: { id: true, ...COMMERCE_SELECT.limitedVariants.select },
      },
      user: {
        select: {
          id: true,
          name: true,
          lastName: true,
          handler: true,
        },
      },
    },
  })

interface ArtworkPageProps {
  params: Promise<{ slug: string }>
  /**
   * `exhibition`, `artist` and `from` are set by the grid the visitor arrived
   * through. One of them is the only thing that tells this page the visitor is
   * walking a set rather than looking at one work, and which set the
   * previous/next arrows step through. `from=prints` means the gallery's own
   * selection; `artist` is a handler.
   */
  searchParams: Promise<{ exhibition?: string; artist?: string; from?: string }>
}

/**
 * Previous/next within the exhibition the visitor came from — plain links to
 * the neighbouring artwork URLs, nothing else. Returns null whenever there is
 * no set to walk: no context param, an exhibition that no longer resolves, or
 * a work that isn't in it (a stale link, or one hidden from the show since).
 */
async function getExhibitionNeighbours(
  slug: string,
  exhibitionSlug: string | undefined,
): Promise<ArtworkNeighbours | null> {
  if (!exhibitionSlug) return null

  const exhibition = await getPublicExhibitionByUrl(exhibitionSlug)
  const works = exhibition?.artworks ?? []
  const index = works.findIndex((a) => a.slug === slug)
  if (index === -1) return null

  // The context has to survive the hop, or the arrows would work once and then
  // vanish on the very next page.
  const context = `?exhibition=${encodeURIComponent(exhibitionSlug)}`
  const toNeighbour = (work: (typeof works)[number] | undefined) =>
    work ? { href: `/artworks/${work.slug}${context}`, title: work.title || work.name } : null

  const prev = toNeighbour(works[index - 1])
  const next = toNeighbour(works[index + 1])
  // Nothing on either side — a one-work show. No arrows rather than two dead
  // ones.
  if (!prev && !next) return null

  return { prev, next }
}

/**
 * Previous/next within the gallery's print selection — the /prints order, which
 * is the curator's own.
 *
 * Deliberately NOT filtered by whatever the visitor had narrowed the grid to:
 * those filters never reach the URL, so the honest choice is to walk the set the
 * page is actually a selection OF. Returns null on the same terms as the
 * exhibition walker — no context, a work no longer selected, or a selection with
 * nothing either side of it.
 */
async function getPrintsNeighbours(
  slug: string,
  from: string | undefined,
): Promise<ArtworkNeighbours | null> {
  if (from !== 'prints') return null

  // Already ordered by the curator and already filtered to what a buyer can
  // complete — the exact list /prints renders, so the arrows cannot walk into a
  // work the grid does not show.
  const selection = await getGallerySelection()
  const index = selection.findIndex((c) => c.slug === slug)
  if (index === -1) return null

  const toNeighbour = (card: (typeof selection)[number] | undefined) =>
    card ? { href: `/artworks/${card.slug}?from=prints`, title: card.title || card.name } : null

  const prev = toNeighbour(selection[index - 1])
  const next = toNeighbour(selection[index + 1])
  if (!prev && !next) return null

  return { prev, next }
}

/**
 * Previous/next within one artist's featured works — the order their profile
 * grid renders, which is the artist's own.
 *
 * Same terms as the other two walkers: null for no context, an artist who no
 * longer resolves (unpublished since), a work that isn't among their featured
 * pieces, or a profile with nothing either side.
 */
async function getArtistNeighbours(
  slug: string,
  handler: string | undefined,
): Promise<ArtworkNeighbours | null> {
  if (!handler) return null

  const artist = await getPublicArtistByHandler(handler)
  const works = artist?.artworks ?? []
  const index = works.findIndex((a) => a.slug === slug)
  if (index === -1) return null

  const context = `?artist=${encodeURIComponent(handler)}`
  const toNeighbour = (work: (typeof works)[number] | undefined) =>
    work ? { href: `/artworks/${work.slug}${context}`, title: work.title || work.name } : null

  const prev = toNeighbour(works[index - 1])
  const next = toNeighbour(works[index + 1])
  if (!prev && !next) return null

  return { prev, next }
}

export async function generateMetadata({ params }: ArtworkPageProps): Promise<Metadata> {
  const { slug } = await params

  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      imageUrl: true,
      user: { select: { name: true, lastName: true } },
    },
  })

  if (!artwork) {
    return { title: 'Artwork Not Found' }
  }

  const artistName = `${artwork.user.name} ${artwork.user.lastName}`
  const tabTitle = `${artistName} | ${artwork.title}`
  const description = artwork.description?.slice(0, 160) || `"${artwork.title}" by ${artistName}.`

  return {
    title: { absolute: tabTitle },
    description,
    openGraph: {
      title: tabTitle,
      description,
      ...(artwork.imageUrl && {
        images: [{ url: artwork.imageUrl, alt: tabTitle }],
      }),
    },
  }
}

const ArtworkPage = async ({ params, searchParams }: ArtworkPageProps) => {
  const { slug } = await params
  const { exhibition: exhibitionSlug, artist: artistHandler, from } = await searchParams

  const artwork = await getArtwork(slug)
  if (!artwork) notFound()

  // `printPriceCents` is pulled out rather than spread onward: it is the
  // ARTIST's cut, the pricing INPUT, and the gallery's margin is one
  // subtraction away from it. The server needs it to cost the sale; the browser
  // must never see it.
  const { user, limitedVariants, printPriceCents, ...artworkData } = artwork

  // The same resolved payload the exhibition modal receives, so the two
  // surfaces describe a sale identically.
  const commerce = await buildArtworkCommerce(artwork.id, {
    ...artworkData,
    printPriceCents,
    limitedVariants,
  })

  const media = await getArtworkMedia(artwork.id)

  // Narrowest set first, matching the order ArtworkGrid resolves its context in.
  // Each walker returns null immediately when its own param is absent, so only
  // the one that applies costs a query.
  const neighbours =
    (await getExhibitionNeighbours(slug, exhibitionSlug)) ??
    (await getArtistNeighbours(slug, artistHandler)) ??
    (await getPrintsNeighbours(slug, from))

  // How many numbers are left across the live variants. Live variants can all
  // exist while every copy is gone — that is sold out, not unpurchasable, and
  // the page says so rather than offering a button the wizard would refuse.
  const availableNumberCount =
    limitedVariants.length > 0
      ? await prisma.editionNumber.count({
          where: { variantId: { in: limitedVariants.map((v) => v.id) }, state: 'available' },
        })
      : 0

  return (
    <ArtworkDetailPage
      artwork={{ ...artworkData, liveVariantCount: limitedVariants.length, availableNumberCount }}
      artist={user}
      media={media}
      commerce={commerce}
      neighbours={neighbours}
    />
  )
}

export default ArtworkPage
