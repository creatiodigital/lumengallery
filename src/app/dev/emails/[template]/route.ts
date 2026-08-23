import { EMAIL_BRAND } from '@/lib/emails/brand'
import { renderEmailLayout } from '@/lib/emails/layout'
import { emailButton, emailHeading, emailParagraph } from '@/lib/emails/components'
import { renderAdminCriticalAlertEmail } from '@/lib/emails/adminCriticalAlert'
import { renderArtistPayoutEmail } from '@/lib/emails/artistPayout'
import { renderAuthorizationExpiryWarningEmail } from '@/lib/emails/authorizationExpiryWarning'
import { renderOrderPlacedEmail } from '@/lib/emails/orderPlaced'
import { renderCartOrderPlacedEmail } from '@/lib/emails/cartOrderPlaced'
import { renderOrderInProductionEmail } from '@/lib/emails/orderInProduction'
import { renderOrderShippedEmail } from '@/lib/emails/orderShipped'
import { renderOrderDeliveredEmail } from '@/lib/emails/orderDelivered'
import { renderRefundIssuedEmail } from '@/lib/emails/refundIssued'
import { renderOrderCancelledEmail } from '@/lib/emails/orderCancelled'
import { renderInquiryAdminNotificationEmail } from '@/lib/emails/inquiryAdminNotification'
import { renderInquiryUserConfirmationEmail } from '@/lib/emails/inquiryUserConfirmation'
import { renderAdminOrderNotificationEmail } from '@/lib/emails/adminOrderNotification'
import { renderAdminCartOrderNotificationEmail } from '@/lib/emails/adminCartOrderNotification'
import { renderAdminOrderCancelledEmail } from '@/lib/emails/adminOrderCancelled'
import { renderLoginCodeEmail } from '@/lib/emails/loginCode'
import { renderForgotPasswordEmail } from '@/lib/emails/forgotPassword'
import { renderArtistInviteEmail } from '@/lib/emails/artistInvite'

// Dev-only preview of branded emails with SAMPLE data (no DB, no real send).
// 404 in production so it never ships to buyers.
function sampleHtml(): string {
  const body =
    emailHeading('Thank you, Jane') +
    emailParagraph(
      "Your order is confirmed. We'll begin printing shortly — your invoice will follow once it's in production.",
    ) +
    emailButton('View your order', 'https://theartroom.gallery/account/orders')
  return renderEmailLayout({ preheader: 'Your order is confirmed', bodyHtml: body })
}

const TEMPLATES: Record<string, () => string> = {
  sample: sampleHtml,
  'admin-critical-alert': () =>
    renderAdminCriticalAlertEmail({
      title: 'Order row missing after charge',
      problem: 'createPrintOrderFromPaymentIntent threw: P2002 unique constraint …\n  at line 247',
      paymentIntentId: 'pi_3Example',
      context: { buyerEmail: 'jane@example.com', amount: '€229.90' },
      whatToDo: [
        'Check Stripe for the captured PaymentIntent',
        'Manually create the order row from admin',
        'Verify the buyer received confirmation',
      ],
    }).html,
  'authorization-expiry': () =>
    renderAuthorizationExpiryWarningEmail({
      ordersUrl: 'https://theartroom.gallery/admin/orders',
      orders: [
        {
          orderRef: 'AD81E642',
          buyerName: 'Jane Smith',
          totalCents: 22990,
          currency: 'eur',
          days: 5,
          daysLeft: 2,
          lapsed: false,
        },
        {
          orderRef: 'B71C0F3A',
          buyerName: 'John Doe',
          totalCents: 31100,
          currency: 'eur',
          days: 8,
          daysLeft: 0,
          lapsed: true,
        },
      ],
    }).html,
  'artist-payout': () =>
    renderArtistPayoutEmail({
      to: 'artist@example.com',
      artistFirstName: 'John',
      artworkTitle: 'Puerta Verde',
      amountCents: 12500,
      currency: 'eur',
      transferId: 'tr_Example',
    }).html,
  'order-placed': () =>
    renderOrderPlacedEmail({
      to: 'jane@example.com',
      buyerName: 'Jane Smith',
      artistName: 'John Doe',
      orderId: 'cld4b8e1a905c7',
      artworkTitle: 'Puerta Verde',
      specs: [
        { label: 'Edition', value: 'Limited Edition · Medium' },
        { label: 'Print type', value: 'Giclée fine-art print' },
        { label: 'Paper', value: 'Hahnemühle Photo Rag 308gsm' },
        { label: 'Size', value: '59.4 × 42.0 cm' },
        { label: 'Format', value: 'Framed' },
        { label: 'Frame', value: 'Black ash' },
        { label: 'Glass', value: 'Anti-reflective' },
        { label: 'Border', value: '3 cm' },
      ],
      itemTotalCents: 17500,
      shippingCents: 1500,
      vatCents: 3990,
      vatLabel: 'VAT (Spain 21%)',
      totalCents: 22990,
      currency: 'eur',
      shippingCountryCode: 'ES',
    }).html,
  'cart-order-placed': () =>
    renderCartOrderPlacedEmail({
      to: 'jane@example.com',
      buyerName: 'Jane Smith',
      orderId: 'clr7f3a9c2e1b8d',
      lines: [
        {
          artworkTitle: 'Puerta Verde',
          artistName: 'John Doe',
          quantity: 2,
          lineTotalCents: 42000,
          specs: [
            { label: 'Edition', value: 'Limited Edition · Medium' },
            { label: 'Print type', value: 'Giclée fine-art print' },
            { label: 'Paper', value: 'Hahnemühle Photo Rag 308gsm' },
            { label: 'Size', value: '59.4 × 42.0 cm' },
            { label: 'Format', value: 'Framed' },
            { label: 'Frame', value: 'Natural oak' },
            { label: 'Glass', value: 'Anti-reflective' },
          ],
        },
        {
          artworkTitle: 'Landscape and River',
          artistName: 'John Doe',
          quantity: 1,
          lineTotalCents: 28000,
          specs: [
            { label: 'Edition', value: 'Open Edition' },
            { label: 'Print type', value: 'Giclée fine-art print' },
            { label: 'Paper', value: 'Photo Rag Baryta 315gsm' },
            { label: 'Size', value: '42.0 × 29.7 cm' },
            { label: 'Format', value: 'Print only' },
            { label: 'Border', value: '2 cm' },
          ],
        },
      ],
      subtotalCents: 70000,
      shippingCents: 2000,
      vatCents: 15120,
      vatLabel: 'VAT (Spain 21%)',
      totalCents: 87120,
      currency: 'eur',
      shippingCountryCode: 'ES',
    }).html,
  'order-in-production': () =>
    renderOrderInProductionEmail({
      to: 'jane@example.com',
      buyerName: 'Jane Smith',
      artistName: 'John Doe',
      artworkTitle: 'Puerta Verde',
      orderId: 'cld4b8e1a905c7',
      editions: [{ artworkTitle: 'Puerta Verde', number: 3, editionSize: 45 }],
    }).html,
  'order-shipped': () =>
    renderOrderShippedEmail({
      to: 'jane@example.com',
      buyerName: 'Jane Smith',
      artistName: 'John Doe',
      artworkTitle: 'Puerta Verde',
      orderId: 'cld4b8e1a905c7',
      trackingUrl: 'https://tracking.example.com/XYZ',
    }).html,
  'order-delivered': () =>
    renderOrderDeliveredEmail({
      to: 'jane@example.com',
      buyerName: 'Jane Smith',
      artistName: 'John Doe',
      artworkTitle: 'Puerta Verde',
      orderId: 'cld4b8e1a905c7',
    }).html,
  'refund-issued': () =>
    renderRefundIssuedEmail({
      to: 'jane@example.com',
      buyerName: 'Jane Smith',
      orderId: 'cld4b8e1a905c7',
      amountCents: 22990,
      currency: 'eur',
    }).html,
  'order-cancelled': () =>
    renderOrderCancelledEmail({
      to: 'jane@example.com',
      buyerName: 'Jane Smith',
      artistName: 'John Doe',
      artworkTitle: 'Puerta Verde',
      orderId: 'cld4b8e1a905c7',
      paymentStatus: 'refunded',
    }).html,
  'inquiry-admin': () =>
    renderInquiryAdminNotificationEmail({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '+34 600 000 000',
      message: 'Is this piece still available, and can it ship framed?',
      artworkTitle: 'Puerta Verde',
      artworkArtist: 'John Doe',
      artworkSlug: 'puerta-verde',
    }).html,
  'inquiry-user': () =>
    renderInquiryUserConfirmationEmail({
      firstName: 'Jane',
      email: 'jane@example.com',
      message: 'Is this piece still available, and can it ship framed?',
      artworkTitle: 'Puerta Verde',
      artworkArtist: 'John Doe',
    }).html,
  'admin-order': () =>
    renderAdminOrderNotificationEmail({
      orderId: 'cld4b8e1a905c7',
      artworkTitle: 'Puerta Verde',
      artistName: 'John Doe',
      buyerName: 'Jane Smith',
      buyerEmail: 'jane@example.com',
      shippingAddress: {
        line1: '123 Main St',
        line2: '',
        city: 'Madrid',
        state: '',
        postalCode: '28001',
        country: 'Spain',
        phone: '',
      },
      totalCents: 22990,
      currency: 'eur',
      skuAttributes: {
        'Print type': 'Giclée',
        Paper: 'Hahnemühle Photo Rag',
        Size: '59.4 × 42.0 cm',
        Frame: 'Black ash',
      },
      adminOrderUrl: 'https://theartroom.gallery/admin/orders/cld4b8e1a905c7',
    }).html,
  'admin-cart-order': () =>
    renderAdminCartOrderNotificationEmail({
      orderId: 'cld4b8e1a905c7',
      buyerName: 'Jane Smith',
      buyerEmail: 'jane@example.com',
      shippingAddress: {
        line1: '123 Main St',
        line2: '',
        city: 'Madrid',
        state: '',
        postalCode: '28001',
        country: 'Spain',
        phone: '',
      },
      totalCents: 22990,
      currency: 'eur',
      adminOrderUrl: 'https://theartroom.gallery/admin/orders/cld4b8e1a905c7',
      lines: [
        {
          artworkTitle: 'Puerta Verde',
          artistName: 'John Doe',
          quantity: 1,
          skuAttributes: {
            'Print type': 'Giclée',
            Paper: 'Hahnemühle Photo Rag',
            Size: '59.4 × 42.0 cm',
            Frame: 'Black ash',
          },
        },
        {
          artworkTitle: 'Landscape and River',
          artistName: 'John Doe',
          quantity: 2,
          skuAttributes: {
            'Print type': 'Giclée',
            Paper: 'Photo Rag Baryta 315gsm',
            Size: '42.0 × 29.7 cm',
            Frame: 'Natural oak',
          },
        },
      ],
    }).html,
  'admin-order-cancelled': () =>
    renderAdminOrderCancelledEmail({
      orderId: 'cld4b8e1a905c7',
      artworkTitle: 'Puerta Verde',
      artistName: 'John Doe',
      buyerName: 'Jane Smith',
      buyerEmail: 'jane@example.com',
      paymentStatus: 'succeeded',
      totalCents: 22990,
      currency: 'eur',
      adminOrderUrl: 'https://theartroom.gallery/admin/orders/cld4b8e1a905c7',
    }).html,
  'login-code': () => renderLoginCodeEmail({ code: '482913' }).html,
  'forgot-password': () =>
    renderForgotPasswordEmail({
      name: 'Jane Smith',
      resetUrl: 'https://theartroom.gallery/reset?token=sample',
    }).html,
  'artist-invite': () =>
    renderArtistInviteEmail({
      name: 'John Doe',
      email: 'john@example.com',
      tempPassword: 'Temp-7Q2K9',
      loginUrl: 'https://theartroom.gallery/login',
    }).html,
}

export async function GET(req: Request, ctx: { params: Promise<{ template: string }> }) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 })
  }
  const { template } = await ctx.params
  const render = TEMPLATES[template]
  if (!render) return new Response('Unknown template', { status: 404 })
  // Real emails reference the marks at the deployed absolute URL. Locally those
  // PNGs aren't on the prod domain yet, so rewrite the base to this request's
  // origin (where /email/*.png is served) so the preview shows the marks.
  const origin = new URL(req.url).origin
  const html = render().split(EMAIL_BRAND.siteUrl).join(origin)
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
