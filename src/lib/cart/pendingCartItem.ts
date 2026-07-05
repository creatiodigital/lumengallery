import type { WizardConfig } from '@/lib/print-providers/types'

/**
 * One staged line inside `PendingCart.items` — THE contract between the cart
 * checkout writer (createCartPaymentIntent, which prices and stages the line)
 * and the order builder reader (createPrintOrderFromCart, which the webhook /
 * ensureOrder / reconcile layers all call). Both sides import this single
 * type, so a shape change breaks the build at the write site instead of
 * silently producing a €0, artist-less order when the webhook replays the
 * JSON. The `as unknown as` bridges at the Prisma Json boundary are the only
 * casts allowed to touch this shape.
 */
export type PendingCartItem = {
  lineId: string
  artworkId: string
  artistUserId: string
  variantId: string | null
  editionType: 'open' | 'limited'
  printConfig: WizardConfig
  quantity: number
  productionCents: number
  artistCents: number
  galleryCents: number
  editionNumberIds: string[]
}
