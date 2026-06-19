import { renderEmailLayout } from '@/lib/emails/layout'
import { emailButton, emailHeading, emailParagraph } from '@/lib/emails/components'
import { renderOrderPlacedEmail } from '@/lib/emails/orderPlaced'
import { renderCartOrderPlacedEmail } from '@/lib/emails/cartOrderPlaced'

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
  'order-placed': () =>
    renderOrderPlacedEmail({
      to: 'jane@example.com',
      buyerName: 'Jane Smith',
      artistName: 'John Doe',
      orderId: 'sample-order-1234',
      artworkTitle: 'Puerta Verde',
      totalCents: 21100,
      currency: 'eur',
      shippingCountryCode: 'ES',
    }).html,
  'cart-order-placed': () =>
    renderCartOrderPlacedEmail({
      to: 'jane@example.com',
      buyerName: 'Jane Smith',
      orderId: 'sample-order-5678',
      lines: [
        { artworkTitle: 'Puerta Verde', artistName: 'John Doe', quantity: 2 },
        { artworkTitle: 'Landscape and River', artistName: 'John Doe', quantity: 1 },
      ],
      totalCents: 84400,
      currency: 'eur',
      shippingCountryCode: 'ES',
    }).html,
}

export async function GET(_req: Request, ctx: { params: Promise<{ template: string }> }) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 })
  }
  const { template } = await ctx.params
  const render = TEMPLATES[template]
  if (!render) return new Response('Unknown template', { status: 404 })
  return new Response(render(), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
