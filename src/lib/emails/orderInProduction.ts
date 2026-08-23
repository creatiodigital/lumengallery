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
import { formatOrderRef } from '@/lib/orders/orderRef'

const resend = new Resend(process.env.RESEND_API_KEY)

/** One numbered limited-edition copy on the order. Open-edition lines have no
 *  number, so they never appear here. */
type EditionAssignment = {
  artworkTitle: string
  number: number
  editionSize: number
}

type OrderInProductionArgs = {
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
 * Pure renderer — builds the subject and HTML for the order-in-production email.
 * No side effects; safe to call from preview routes.
 */
export function renderOrderInProductionEmail(args: OrderInProductionArgs): {
  subject: string
  html: string
} {
  const firstName = escapeHtml(args.buyerName.split(' ')[0] || 'there')
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeOrderId = formatOrderRef(args.orderId)

  const editions = args.editions ?? []
  const hasEditions = editions.length > 0
  const isSingleEdition = editions.length === 1

  // Reinforces, in restrained terms, exactly what the buyer was promised at
  // checkout: the copy is individually numbered (printed into the margin) and
  // arrives with an artist-signed Certificate of Authenticity. No hype — the
  // authenticity marks themselves carry the prestige.
  const editionParagraph = !hasEditions
    ? ''
    : isSingleEdition
      ? emailParagraph(
          `This work is a limited edition, and your copy is <strong>No. ${editions[0].number} of ${editions[0].editionSize}</strong>. The number is printed into the margin of the print, and it arrives with a Certificate of Authenticity, signed by ${safeArtist}.`,
        )
      : emailParagraph(
          `These are limited editions. Each copy is individually numbered — printed into the margin — and arrives with a Certificate of Authenticity signed by the artist.`,
        )

  const detailRows = [
    { label: 'Artwork', value: safeArtwork },
    { label: 'Artist', value: safeArtist },
    ...(isSingleEdition
      ? [{ label: 'Edition', value: `No. ${editions[0].number} of ${editions[0].editionSize}` }]
      : []),
  ]

  // For a multi-copy cart, list each numbered copy under its own heading.
  const editionsList =
    hasEditions && !isSingleEdition
      ? emailEyebrow('Your editions') +
        emailDetailRows(
          editions.map((e) => ({
            label: escapeHtml(e.artworkTitle) || 'Print',
            value: `No. ${e.number} of ${e.editionSize}`,
          })),
        )
      : ''

  const body =
    emailHeading(`Good news, ${firstName}`) +
    emailParagraph(
      `Your print is now being produced by our fine-art print lab. Everything is in hand.`,
    ) +
    editionParagraph +
    emailParagraph(
      `We&rsquo;ll send you another email with tracking details as soon as it ships.`,
    ) +
    emailDivider() +
    emailEyebrow(`Order ${safeOrderId}`) +
    emailDetailRows(detailRows) +
    editionsList +
    emailDivider() +
    emailParagraph(`If anything changes with your order, we&rsquo;ll be in touch right away.`)

  return {
    subject: 'Your print is being produced',
    html: renderEmailLayout({ preheader: 'Your print is being produced', bodyHtml: body }),
  }
}

/**
 * Sent to the buyer once production starts on the print
 * (stage transitions to `Started`). Bridge between the initial "order
 * received" email and the shipping notification.
 *
 * Resolves `{ ok: false }` on failure rather than throwing, so the
 * caller can log + continue without aborting the sync.
 */
export async function sendOrderInProductionEmail(
  args: OrderInProductionArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderOrderInProductionEmail(args)

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
