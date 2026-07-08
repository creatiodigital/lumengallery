import type { Prisma } from '@/generated/prisma'

/**
 * Master-original fields that must NEVER appear on a public artwork read.
 * `originalImageUrl` points at the 60MB+ print master on the public R2 bucket
 * (key secrecy is its only protection); the sibling metadata columns are print
 * internals. Single source of truth so a future sensitive column is stripped
 * everywhere by editing one place. Fulfillment reads the master server-side and
 * does not go through these public endpoints.
 */
export const PUBLIC_ARTWORK_OMIT = {
  originalImageUrl: true,
  originalSizeBytes: true,
  originalDpi: true,
  originalFormat: true,
} satisfies Prisma.ArtworkOmit
