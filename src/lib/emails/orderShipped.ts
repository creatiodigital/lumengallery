import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailButton,
  emailDetailRows,
  emailDivider,
  emailEyebrow,
  emailHeading,
  emailParagraph,
} from './components'
import { renderEmailLayout } from './layout'
import { editionDetailRows, editionsListBlock, type EditionAssignment } from './editionCopies'
import { formatOrderRef } from '@/lib/orders/orderRef'

const resend = new Resend(process.env.RESEND_API_KEY)

type OrderShippedArgs = {
  to: string
  buyerName: string
  orderId: string
  artworkTitle: string
  artistName: string
  trackingUrl: string | null
  /** Limited-edition copies on this order. Empty/undefined for open editions —
   *  the edition row is then omitted entirely. Safe to name by now: the number
   *  is committed once production starts, which is before anything ships. */
  editions?: EditionAssignment[]
}

/**
 * Pure renderer — builds the subject and HTML for the order-shipped email.
 * No side effects; safe to call from preview routes.
 */
export function renderOrderShippedEmail(args: OrderShippedArgs): { subject: string; html: string } {
  const firstName = escapeHtml(args.buyerName.split(' ')[0] || 'there')
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeOrderId = formatOrderRef(args.orderId)
  const safeTrackingUrl = args.trackingUrl ? escapeHtml(args.trackingUrl) : null
  const editions = args.editions ?? []

  const body =
    emailHeading(`It&rsquo;s on its way, ${firstName}`) +
    emailParagraph(
      `Your print has shipped. It&rsquo;s now in the carrier&rsquo;s hands and heading your way.`,
    ) +
    (safeTrackingUrl ? emailButton('Track your shipment', safeTrackingUrl) : '') +
    emailDivider() +
    emailEyebrow(`Order ${safeOrderId}`) +
    emailDetailRows([
      { label: 'Artwork', value: safeArtwork },
      { label: 'Artist', value: safeArtist },
      ...editionDetailRows(editions),
    ]) +
    editionsListBlock(editions) +
    emailDivider() +
    emailParagraph(
      `When it arrives, we kindly suggest taking a few photos, or a short video, as you unwrap it &mdash; the sealed parcel first, then the moment you open it.`,
    ) +
    emailParagraph(
      `Damage in transit is rare and your print travels well protected. But should anything arrive less than perfect, those images let us arrange a reprint or a refund right away, with no back-and-forth. Just reply to this email.`,
    ) +
    emailParagraph(`Enjoy the work.`)

  return {
    subject: 'Your artwork is on its way',
    html: renderEmailLayout({ preheader: 'Your artwork is on its way', bodyHtml: body }),
  }
}

/**
 * Sent to the buyer once the print enters the carrier
 * (a shipment's status transitions to `Shipped`). Includes the tracking
 * URL if production provided one — most shipments do.
 *
 * Resolves `{ ok: false }` on failure rather than throwing, so the
 * caller can log + continue without aborting the sync.
 */
export async function sendOrderShippedEmail(
  args: OrderShippedArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html } = renderOrderShippedEmail(args)

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
