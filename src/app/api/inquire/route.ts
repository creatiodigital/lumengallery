import { NextRequest, NextResponse } from 'next/server'

import { getClientIp } from '@/lib/getClientIp'
import { validateInquiry } from '@/lib/inquiry/validateInquiry'
import { rateLimit } from '@/lib/rateLimit'
import { sendInquiryAdminNotificationEmail } from '@/lib/emails/inquiryAdminNotification'

/**
 * Artwork inquiry → notifies the gallery.
 *
 * This endpoint used to send TWO emails: one to the gallery, and a confirmation
 * to the address supplied in the request body. That second send made the route
 * an open relay — anyone could have `contact@theartroom.gallery` deliver a
 * message to an address of their choosing, with SPF, DKIM and DMARC all passing,
 * because it really was the gallery sending it. At the per-IP limit that is
 * ~4,300 attacker-directed emails a day from a single host.
 *
 * Quota was never the binding constraint; DELIVERABILITY was. Around a hundred
 * such messages to unsorted addresses pushes the bounce rate past what mail
 * providers tolerate, and all nineteen senders share this one identity — so the
 * blast radius included order confirmations, invoices that are legal documents
 * under Spanish invoicing rules, and the login codes the team needs to sign in.
 *
 * The confirmation send is therefore gone. The gallery notification is the half
 * with business value, the UI already shows the visitor a success modal, and the
 * owner replies personally (the notification carries the inquirer as reply-to).
 * Restoring a confirmation later means solving recipient verification first.
 */

/**
 * A real gallery receives single-digit inquiries a day. This ceiling is
 * enormous headroom for that and still a hard stop on a flood — the per-IP limit
 * alone is meaningless against a rotating pool. Modelled on the global cap that
 * already protects the Places proxy, which is the one surface in the app that
 * was correctly bounded.
 */
const DAILY_CAP = Number(process.env.INQUIRY_DAILY_CAP ?? 100)
const DAY_SECONDS = 86_400

export async function POST(request: NextRequest) {
  try {
    // Durable limiter keyed on the trusted client IP, not the spoofable first
    // forwarded hop.
    const ip = getClientIp(request)
    const [perIp, daily] = await Promise.all([
      rateLimit({ name: 'inquire', key: ip, limit: 3, windowSeconds: 60 }),
      rateLimit({ name: 'inquire-daily', key: 'global', limit: DAILY_CAP, windowSeconds: DAY_SECONDS }),
    ])

    if (!perIp.success || !daily.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const result = validateInquiry(body)

    if (!result.ok) {
      // A tripped honeypot is answered exactly like a success and nothing is
      // sent. Telling a bot it was spotted only teaches it which field to skip.
      if (result.drop) return NextResponse.json({ success: true })
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // Sanitized but not yet escaped — the renderer escapes internally, and it
    // must, because these values are attacker-controlled by definition.
    await sendInquiryAdminNotificationEmail(result.value)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing inquiry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
