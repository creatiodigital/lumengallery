import { renderEmailLayout } from '@/lib/emails/layout'
import { emailButton, emailHeading, emailParagraph } from '@/lib/emails/components'

// Dev-only preview of branded emails with SAMPLE data (no DB, no real send).
// 404 in production so it never ships to buyers.
function sampleHtml(): string {
  const body =
    emailHeading('Thank you, Jane') +
    emailParagraph(
      "Your order is confirmed. We’ll begin printing shortly — your invoice will follow once it’s in production.",
    ) +
    emailButton('View your order', 'https://theartroom.gallery/account/orders')
  return renderEmailLayout({ preheader: 'Your order is confirmed', bodyHtml: body })
}

const TEMPLATES: Record<string, () => string> = {
  sample: sampleHtml,
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
