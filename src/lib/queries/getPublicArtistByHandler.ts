import { SALE_SELECT, saleFromRow, type ArtworkSale } from '@/lib/editions/artworkSale'
import prisma from '@/lib/prisma'

export type PublicArtistArtwork = {
  id: string
  slug: string
  name: string
  title: string | null
  author: string | null
  year: string | null
  technique: string | null
  dimensions: string | null
  imageUrl: string | null
  originalWidth: number | null
  originalHeight: number | null
  /** What the card says about buying a print. Null = not for sale, so the card
   *  shows no commerce at all. See `resolveArtworkSale`. */
  sale: ArtworkSale | null
}

export type PublicArtistExhibition = {
  id: string
  mainTitle: string
  url: string
  handler: string | null
  featuredImageUrl: string | null
  shortDescription: string | null
}

export type PublicArtist = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string | null
  profileImageUrl: string | null
  exhibitions: PublicArtistExhibition[]
  artworks: PublicArtistArtwork[]
}

/**
 * Reads a published artist for the public profile page: the artist, their
 * published exhibitions, and their featured image works — one round-trip.
 * Returns null for a missing or unpublished artist so the route can 404.
 *
 * Lifted out of the page component so the sale resolution below is testable
 * without a browser, and so this sits beside `getPublicExhibitionByUrl`, whose
 * grid has to answer exactly the same question.
 */
export async function getPublicArtistByHandler(handler: string): Promise<PublicArtist | null> {
  const artist = await prisma.user.findFirst({
    where: { handler, published: true },
    select: {
      id: true,
      name: true,
      lastName: true,
      handler: true,
      biography: true,
      profileImageUrl: true,
      exhibitions: {
        where: { published: true },
        select: {
          id: true,
          mainTitle: true,
          url: true,
          handler: true,
          featuredImageUrl: true,
          shortDescription: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      artworks: {
        where: { artworkType: 'image', featured: true },
        select: {
          id: true,
          slug: true,
          name: true,
          title: true,
          author: true,
          year: true,
          technique: true,
          dimensions: true,
          imageUrl: true,
          ...SALE_SELECT,
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!artist) return null

  return {
    ...artist,
    // The pricing inputs are resolved here and dropped: `printPriceCents` is
    // the ARTIST's cut, not a buyer-facing figure, and must not reach the
    // client. Only the resolved `sale` crosses the boundary.
    artworks: artist.artworks.map((row) => {
      const { editionType, printEnabled, printPriceCents, limitedVariants, ...artwork } = row
      return {
        ...artwork,
        sale: saleFromRow({
          editionType,
          printEnabled,
          printPriceCents,
          originalWidth: artwork.originalWidth,
          originalHeight: artwork.originalHeight,
          limitedVariants,
        }),
      }
    }),
  }
}
