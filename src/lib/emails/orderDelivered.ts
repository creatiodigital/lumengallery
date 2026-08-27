import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailDetailRows,
  emailDivider,
  emailEyebrow,
  emailHeading,
  emailParagraph,
} from './components'
import { renderEmailLayout } from './layout'
import {
  editionDetailRows,
  editionsListBlock,
  formatEditionCopy,
  type EditionAssignment,
} from './editionCopies'
import { formatOrderRef } from '@/lib/orders/orderRef'

const resend = new Resend(process.env.RESEND_API_KEY)

type OrderDeliveredArgs = {
  to: string
  buyerName: string
  orderId: string
  artworkTitle: string
  artistName: string
  /** Limited-edition copies on this order. Empty/undefined for open editions —
   *  the edition block is then omitted entirely. */
  editions?: EditionAssignment[]
}

/**
 * Pure renderer — builds the subject and HTML for the order-delivered email.
 * No side effects; safe to call from preview routes.
 */
export function renderOrderDeliveredEmail(args: OrderDeliveredArgs): {
  subject: string
  html: string
} {
  const firstName = escapeHtml(args.buyerName.split(' ')[0] || 'there')
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeOrderId = formatOrderRef(args.orderId)
  const editions = args.editions ?? []

  // The buyer now holds the object, so this is the moment to point at the two
  // places the number lives on it — the margin and the certificate — and to ask
  // that they stay together. A print separated from its certificate loses the
  // provenance the edition number exists to carry.
  const certificateParagraph =
    editions.length === 0
      ? ''
      : editions.length === 1
        ? emailParagraph(
            `Your copy is <strong>${formatEditionCopy(editions[0])}</strong>. The number is printed into the margin, and the Certificate of Authenticity in the parcel &mdash; signed by ${safeArtist} &mdash; records it too. Keep the two together; that pairing is what proves the work is yours.`,
          )
        : emailParagraph(
            `Each copy is individually numbered &mdash; printed into the margin &mdash; and arrives with a Certificate of Authenticity recording that same number. Keep each print with its certificate; that pairing is what proves the work is yours.`,
          )

  const body =
    emailHeading(`Your artwork has arrived, ${firstName}`) +
    emailParagraph(
      `Your print should be in your hands now. We hope it looks every bit as good as it did on screen &mdash; and even better in the flesh.`,
    ) +
    emailDivider() +
    emailEyebrow(`Order ${safeOrderId}`) +
    emailDetailRows([
      { label: 'Artwork', value: safeArtwork },
      { label: 'Artist', value: safeArtist },
      ...editionDetailRows(editions),
    ]) +
    editionsListBlock(editions) +
    emailDivider() +
    certificateParagraph +
    emailParagraph(
      `If anything looks wrong &mdash; damaged in transit, mis-printed, or simply not what you expected &mdash; just reply to this email with your unboxing photos or video, or a photo of the problem, and we&rsquo;ll make it right.`,
    ) +
    emailParagraph(
      `Otherwise, enjoy living with the work. The artist will receive their payout shortly.`,
    )

  return {
    subject: 'Your artwork has arrived',
    html: renderEmailLayout({ preheader: 'Your artwork has arrived', bodyHtml: body }),
  }
}

/**
 * Sent to the buyer once the buyer receives delivery (admin marks
 * the shipment `Complete`, or admin manually advances an order to
 * the equivalent stage). Closes the loop on the long, multi-week print
 * journey so the buyer doesn't keep wondering whether the package is
 * still in transit.
 *
 * Resolves `{ ok: false }` on failure rather than throwing — the caller
 * logs and continues.
 */
export async function sendOrderDeliveredEmail(
  args: OrderDeliveredArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderOrderDeliveredEmail(args)

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: args.to,
      subject,
      html,
    })

    if (res.error) {
      return { ok: false, error: res.error.message ?? 'resend error' }
    }
    return { ok: true, id: res.data?.id ?? '' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
