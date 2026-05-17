import type { PrintOrder } from '@/generated/prisma'

import prisma from '@/lib/prisma'
import type { SpecsSummary, WizardConfig } from '@/lib/print-providers'
import { summarizeConfig } from '@/lib/print-providers'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import { generateAndUploadCertificate } from '@/lib/certificates/generateAndUploadCertificate'
import { sendAdminCriticalAlert } from '@/lib/emails/adminCriticalAlert'
import { sendAdminOrderNotification } from '@/lib/emails/adminOrderNotification'
import { sendOrderPlacedEmail } from '@/lib/emails/orderPlaced'
import { captureError } from '@/lib/observability/captureError'
import { logOrderEvent } from './logOrderEvent'

type StripePaymentIntent = {
  id: string
  metadata?: Record<string, string>
  shipping?: {
    name?: string | null
    phone?: string | null
    address?: {
      line1?: string | null
      line2?: string | null
      city?: string | null
      state?: string | null
      postal_code?: string | null
      country?: string | null
    } | null
  } | null
  receipt_email?: string | null
}

/**
 * Called from the `payment_intent.amount_capturable_updated` webhook once
 * the buyer's card is authorized (funds held, not captured). Creates (or
 * finds) the local PrintOrder row so the gallery admin can place the
 * order on theprintspace's portal by hand.
 *
 * MANUAL FULFILLMENT MODE: auto-submit is disabled. Buyer's card stays
 * authorized; admin captures manually from Stripe when they place the
 * upstream order. See memory/project_manual_fulfillment_launch.md.
 *
 * Idempotency: the PrintOrder row is keyed on paymentIntentId. If a
 * Stripe webhook retries we'll find the existing row.
 */
export async function createPrintOrderFromPaymentIntent(
  pi: StripePaymentIntent,
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const md = pi.metadata ?? {}
  const artworkId = md.artworkId
  const artistUserId = md.artistUserId
  const country = md.countryCode
  if (!artworkId || !artistUserId || !country) {
    await sendAdminCriticalAlert({
      title: 'Order missing required metadata',
      problem:
        'The Stripe PaymentIntent webhook fired but the metadata fields needed to build a PrintOrder row are missing. The buyer’s card may be authorized — no order row was created.',
      paymentIntentId: pi.id,
      context: {
        artworkId: artworkId ?? '(missing)',
        artistUserId: artistUserId ?? '(missing)',
        countryCode: country ?? '(missing)',
      },
      whatToDo: [
        'Open the PaymentIntent in Stripe and check whether it is in requires_capture or succeeded state.',
        'If the buyer’s card is authorized, cancel the PaymentIntent in Stripe to release the hold.',
        'Contact the buyer (use the receipt_email on the PaymentIntent) to apologize and offer to re-place the order manually.',
        'If you receive multiple of these for the same PI, check the deploy log around the timestamp — the metadata shape may have changed.',
      ],
    })
    return { ok: false, error: 'PaymentIntent missing required metadata.' }
  }

  // Parse the wizard config blob. Stripe metadata values are always
  // strings, so we JSON-decode here. A parse failure means the PI was
  // created by an older code path or the metadata got corrupted —
  // either way, treat as a fatal data error rather than papering over
  // it.
  let config: WizardConfig
  try {
    config = JSON.parse(md.wizardConfig ?? '') as WizardConfig
    if (!config?.values) throw new Error('wizardConfig has no values')
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), {
      flow: 'order',
      stage: 'parse-wizard-config',
      extra: { paymentIntentId: pi.id },
      level: 'error',
      fingerprint: ['order:parse-wizard-config-failed'],
    })
    await sendAdminCriticalAlert({
      title: 'Order config could not be parsed',
      problem: `Failed to parse the wizardConfig metadata blob on the PaymentIntent. ${err instanceof Error ? err.message : String(err)}`,
      paymentIntentId: pi.id,
      context: {
        artworkId,
        artistUserId,
        rawWizardConfigLength: md.wizardConfig?.length ?? 0,
      },
      whatToDo: [
        'Open the PaymentIntent in Stripe and inspect the metadata.wizardConfig value.',
        'Open the buyer’s receipt in Stripe to see what they thought they were buying.',
        'Cancel the PaymentIntent to release the card hold.',
        'Contact the buyer to re-place the order through the wizard.',
      ],
    })
    return { ok: false, error: 'PaymentIntent metadata.wizardConfig could not be parsed.' }
  }

  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
    select: {
      id: true,
      slug: true,
      title: true,
      imageUrl: true,
      originalImageUrl: true,
      originalWidth: true,
      originalHeight: true,
      userId: true,
      user: { select: { name: true, lastName: true, signatureUrl: true } },
    },
  })
  if (!artwork) {
    captureError(new Error(`Artwork ${artworkId} not found during order creation`), {
      flow: 'order',
      stage: 'artwork-not-found',
      extra: { artworkId, artistUserId, paymentIntentId: pi.id },
      level: 'error',
      fingerprint: ['order:artwork-not-found'],
    })
    await sendAdminCriticalAlert({
      title: 'Artwork not found for paid order',
      problem: `The buyer paid for artwork ${artworkId} but no such artwork exists in the database. The most likely cause is that the artwork was deleted between the buyer opening the wizard and Stripe firing the webhook.`,
      paymentIntentId: pi.id,
      context: { artworkId, artistUserId },
      whatToDo: [
        'Cancel the PaymentIntent in Stripe to release the buyer’s card hold.',
        'Contact the buyer to apologize and offer alternatives.',
        'Investigate why the artwork was deleted — soft-delete should be used so paid orders don’t orphan.',
      ],
    })
    return { ok: false, error: `Artwork ${artworkId} not found.` }
  }
  // Guard against cross-artist metadata tampering.
  if (artwork.userId !== artistUserId) {
    captureError(new Error('Artwork/artist mismatch on PaymentIntent'), {
      flow: 'order',
      stage: 'artwork-artist-mismatch',
      extra: {
        artworkId,
        metadataArtistUserId: artistUserId,
        actualArtistUserId: artwork.userId,
        paymentIntentId: pi.id,
      },
      level: 'error',
      fingerprint: ['order:artwork-artist-mismatch'],
    })
    await sendAdminCriticalAlert({
      title: 'Artwork/artist mismatch on paid order',
      problem:
        'The artistUserId on the PaymentIntent metadata does not match the artwork’s actual artist. This is a tampering signal — refusing to create the order.',
      paymentIntentId: pi.id,
      context: {
        artworkId,
        metadataArtistUserId: artistUserId,
        actualArtistUserId: artwork.userId,
      },
      whatToDo: [
        'Cancel the PaymentIntent in Stripe to release the card hold.',
        'Investigate the source of the request — check Sentry for the wizard session.',
        'Do not manually create an order until you have verified the buyer’s actual intent.',
      ],
    })
    return { ok: false, error: 'Artwork/artist mismatch on PaymentIntent.' }
  }

  // Spec rows (Print type / Paper / Frame / Glass / etc.) for the admin
  // email. Re-derived from the config + catalog rather than shipped
  // through PI metadata, since framed configs can exceed Stripe's
  // 500-char per-value cap. The catalog is local data, so this is cheap.
  let specs: SpecsSummary = []
  try {
    const catalog = await loadProviderCatalog('printspace', {
      imageWidthPx: artwork.originalWidth ?? 1000,
      imageHeightPx: artwork.originalHeight ?? 1000,
    })
    specs = summarizeConfig(catalog, config)
  } catch (err) {
    // Specs are display-only — if catalog load or summarize fails we
    // fall back to an empty list (admin email shows raw config) rather
    // than failing the webhook outright. Logged for follow-up.
    captureError(err instanceof Error ? err : new Error(String(err)), {
      flow: 'order',
      stage: 'derive-specs',
      extra: { paymentIntentId: pi.id },
      level: 'warning',
    })
  }

  const buyerName = pi.shipping?.name ?? ''
  const addr = pi.shipping?.address ?? {}

  const buyerEmail = pi.receipt_email ?? md.customerEmail ?? ''
  // The buyer email is the only way we can reach them after the order is
  // placed (transactional emails: order placed, in production, shipped,
  // delivered, refund). An empty string here means we'd silently send
  // every email to nowhere — alert immediately so the admin can recover
  // the address from the Stripe customer record or by phone.
  if (!buyerEmail) {
    await sendAdminCriticalAlert({
      title: 'Order has no buyer email',
      problem:
        'The PaymentIntent has neither receipt_email nor a customerEmail in metadata. The order will be created but the buyer will receive zero transactional emails.',
      paymentIntentId: pi.id,
      context: { artworkId, artistUserId, buyerName },
      whatToDo: [
        'Open the PaymentIntent in Stripe and check for a Customer object with an email.',
        'If you find one, update the PrintOrder.buyerEmail directly in the database.',
        'If you can’t find it, contact the buyer via the shipping phone number.',
      ],
    })
  }

  let order: PrintOrder
  try {
    order = await prisma.printOrder.upsert({
      where: { paymentIntentId: pi.id },
      create: {
        paymentIntentId: pi.id,
        artworkId: artwork.id,
        artistUserId,
        buyerEmail,
        buyerName,
        shippingAddress: {
          line1: addr.line1 ?? '',
          line2: addr.line2 ?? '',
          city: addr.city ?? '',
          state: addr.state ?? '',
          postalCode: addr.postal_code ?? '',
          country: addr.country ?? country,
          phone: pi.shipping?.phone ?? '',
        },
        // Stored as JSON. The admin order page re-renders specs from this
        // rather than the PI metadata.
        printConfig: config as unknown as object,
        country,
        totalCents:
          Number(md.productionCents ?? 0) +
          Number(md.shippingCents ?? 0) +
          Number(md.artistCents ?? 0) +
          Number(md.galleryCents ?? 0) +
          Number(md.customerVatCents ?? 0),
        artistCents: Number(md.artistCents ?? 0),
        galleryCents: Number(md.galleryCents ?? 0),
        productionCents: Number(md.productionCents ?? 0),
        productionShippingCents: Number(md.shippingCents ?? 0),
        customerVatCents: Number(md.customerVatCents ?? 0),
        currency: 'eur',
        paymentStatus: 'authorized',
      },
      // Don't downgrade — if we're already 'succeeded' (captured) keep it.
      update: {},
    })
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), {
      flow: 'order',
      stage: 'upsert-print-order',
      extra: { paymentIntentId: pi.id, artworkId, artistUserId },
      level: 'error',
      fingerprint: ['order:upsert-failed'],
    })
    await sendAdminCriticalAlert({
      title: 'Database write failed for paid order',
      problem: `Could not persist the PrintOrder row. ${err instanceof Error ? err.message : String(err)}`,
      paymentIntentId: pi.id,
      context: { artworkId, artistUserId, buyerEmail, buyerName },
      whatToDo: [
        'Check the database is healthy (Supabase status page).',
        'The Stripe webhook will retry, so this may resolve itself within minutes.',
        'If you keep seeing this alert for the same PI, cancel the PaymentIntent in Stripe and contact the buyer.',
      ],
    })
    return { ok: false, error: 'Database write failed.' }
  }

  // Buyer confirmation email — sent the first time we see this order.
  // The event log is the idempotency gate: if the webhook retries, we
  // find the prior email_sent event and skip.
  const alreadyEmailed = await prisma.printOrderEvent.findFirst({
    where: { orderId: order.id, kind: 'email_sent', message: 'order_placed' },
    select: { id: true },
  })
  if (!alreadyEmailed && order.buyerEmail) {
    const artistName = [artwork.user?.name, artwork.user?.lastName].filter(Boolean).join(' ').trim()
    const emailRes = await sendOrderPlacedEmail({
      to: order.buyerEmail,
      buyerName: order.buyerName,
      orderId: order.id,
      artworkTitle: artwork.title ?? '',
      artistName,
      totalCents: order.totalCents,
      currency: order.currency,
      shippingCountryCode: addr.country ?? country,
    })
    await logOrderEvent({
      orderId: order.id,
      kind: emailRes.ok ? 'email_sent' : 'email_failed',
      actor: 'system',
      message: 'order_placed',
      payload: emailRes.ok
        ? { to: order.buyerEmail, resendId: emailRes.id }
        : { to: order.buyerEmail, error: emailRes.error },
    })
    if (!emailRes.ok) {
      captureError(new Error(`Order-placed email failed: ${emailRes.error}`), {
        flow: 'email',
        stage: 'order-placed-send',
        extra: { orderId: order.id, to: order.buyerEmail, error: emailRes.error },
        level: 'warning',
        fingerprint: ['email:order-placed-failed'],
      })
    }
  }

  const printImageUrl = artwork.originalImageUrl ?? artwork.imageUrl
  if (!printImageUrl) {
    return { ok: false, error: 'Artwork has no image; cannot prepare order.' }
  }

  // Generate the certificate of authenticity PDF, upload to R2, and
  // include the public URL in the admin order page. Idempotent via the
  // event log — if the webhook retries after a successful cert upload
  // we reuse the stored URL instead of re-rendering.
  let certificateUrl = order.certificateUrl
  if (!certificateUrl) {
    const artistName = [artwork.user?.name, artwork.user?.lastName].filter(Boolean).join(' ').trim()
    const certRes = await generateAndUploadCertificate({
      orderId: order.id,
      artworkTitle: artwork.title ?? '',
      artistName,
      signatureImageUrl: artwork.user?.signatureUrl ?? null,
      purchaseDate: order.createdAt,
    })
    if (certRes.ok) {
      certificateUrl = certRes.url
      await prisma.printOrder.update({
        where: { id: order.id },
        data: { certificateUrl: certRes.url },
      })
      await logOrderEvent({
        orderId: order.id,
        kind: 'note',
        actor: 'system',
        message: 'Certificate of authenticity generated',
        payload: { url: certRes.url },
      })
    } else {
      // Non-fatal: log and continue without the certificate. We'd rather
      // create the order and ship the print than block on a cert glitch.
      await logOrderEvent({
        orderId: order.id,
        kind: 'note',
        actor: 'system',
        message: 'Certificate generation failed (order continues without insert)',
        payload: { error: certRes.error },
      })
      captureError(new Error(`Certificate generation failed: ${certRes.error}`), {
        flow: 'cert',
        stage: 'generate-and-upload',
        extra: { orderId: order.id, error: certRes.error },
        level: 'warning',
        fingerprint: ['cert:generate-failed'],
      })
    }
  }

  // Admin order-notification email — idempotent via event log, same
  // pattern as the buyer email. Tells the gallery admin a new order is
  // ready to be placed by hand on theprintspace's portal; surfaces every
  // field needed to recreate the exact order.
  const alreadyNotifiedAdmin = await prisma.printOrderEvent.findFirst({
    where: { orderId: order.id, kind: 'email_sent', message: 'admin_order_notification' },
    select: { id: true },
  })
  if (!alreadyNotifiedAdmin) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'
    const artistName = [artwork.user?.name, artwork.user?.lastName].filter(Boolean).join(' ').trim()
    const attributes: Record<string, string> = Object.fromEntries(
      specs.map((row) => [row.label, row.value]),
    )
    const adminRes = await sendAdminOrderNotification({
      orderId: order.id,
      artworkTitle: artwork.title ?? '',
      artistName,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      shippingAddress: {
        line1: addr.line1 ?? '',
        line2: addr.line2 ?? '',
        city: addr.city ?? '',
        state: addr.state ?? '',
        postalCode: addr.postal_code ?? '',
        country: addr.country ?? country,
        phone: pi.shipping?.phone ?? '',
      },
      totalCents: order.totalCents,
      currency: order.currency,
      skuAttributes: attributes,
      adminOrderUrl: `${siteUrl}/admin/orders/${order.id}`,
    })
    await logOrderEvent({
      orderId: order.id,
      kind: adminRes.ok ? 'email_sent' : 'email_failed',
      actor: 'system',
      message: 'admin_order_notification',
      payload: adminRes.ok ? { resendId: adminRes.id } : { error: adminRes.error },
    })
    if (!adminRes.ok) {
      captureError(new Error(`Admin order-notification email failed: ${adminRes.error}`), {
        flow: 'email',
        stage: 'admin-order-notification-send',
        extra: { orderId: order.id, error: adminRes.error },
        level: 'warning',
        fingerprint: ['email:admin-order-notification-failed'],
      })
    }
  }

  return { ok: true, orderId: order.id }
}
