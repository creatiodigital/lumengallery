import { EMAIL_BRAND } from './brand'

const B = EMAIL_BRAND

// ---------------------------------------------------------------------------
// Notice callout box — bordered panel for duty notes, alerts, and info.
// ---------------------------------------------------------------------------

/**
 * A full-width bordered callout box. Three variants:
 * - `caution` — amber (#fff8e1 / #f0c36d): duty notes, warnings.
 * - `alert`   — red-tinted (#fdecec / #e2a3a3): critical/urgent notices.
 * - `info`    — neutral (beige / hairline): general informational notes.
 *
 * Callers pass already-escaped HTML. Margin 0 0 16px (same as emailParagraph).
 */
export function emailNotice(variant: 'caution' | 'alert' | 'info', html: string): string {
  let bg: string
  let border: string
  let color: string
  if (variant === 'caution') {
    bg = '#fff8e1'
    border = '#f0c36d'
    color = '#111111'
  } else if (variant === 'alert') {
    bg = '#fdecec'
    border = '#e2a3a3'
    color = '#111111'
  } else {
    bg = '#f7f7f5'
    border = B.hairline
    color = B.bodyText
  }
  return `<p style="margin:0 0 16px;padding:12px 14px;background:${bg};border:1px solid ${border};font-size:13px;line-height:1.5;font-family:${B.fontStack};color:${color}">${html}</p>`
}

// ---------------------------------------------------------------------------
// Code block — for OTP codes, temp passwords, redemption codes.
// ---------------------------------------------------------------------------

/**
 * Large centered monospace panel for security codes (OTP / temp passwords).
 * Legibility first: big font, generous letter-spacing, high contrast on beige.
 */
export function emailCodeBlock(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px"><tr><td align="center"><div style="display:inline-block;padding:20px 32px;background:${B.beige};border:1px solid ${B.hairline};font-family:monospace, 'Courier New', Courier;font-size:30px;font-weight:700;letter-spacing:6px;color:${B.ink};line-height:1.2">${code}</div></td></tr></table>`
}

// ---------------------------------------------------------------------------
// Detail rows — two-column label / value table for recipient/shipping blocks.
// ---------------------------------------------------------------------------

/** A label + value pair for {@link emailDetailRows}. */
export type EmailDetailRow = { label: string; value: string }

/**
 * A compact two-column table for address/spec blocks (e.g. shipping address,
 * order metadata). Label column is muted + uppercase-tracked; value column
 * uses valueText — matching the spec-row visual language in emailLineItems.
 */
export function emailDetailRows(rows: EmailDetailRow[]): string {
  const trs = rows
    .map(
      (r) =>
        `<tr><td style="font-family:${B.fontStack};font-size:12px;line-height:1.5;color:${B.muted};padding:2px 16px 2px 0;vertical-align:top;white-space:nowrap;letter-spacing:0.3px;text-transform:uppercase">${r.label}</td><td style="font-family:${B.fontStack};font-size:13px;line-height:1.5;color:${B.valueText};padding:2px 0;vertical-align:top">${r.value}</td></tr>`,
    )
    .join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">${trs}</table>`
}

// NOTE: callers pass already-escaped/safe HTML (escape dynamic values with
// escapeHtml before interpolating).
export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-family:${B.fontStack};font-size:18px;font-weight:700;line-height:1.3;letter-spacing:-0.2px;color:${B.ink}">${text}</h1>`
}

export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${B.fontStack};font-size:14px;line-height:1.65;color:${B.bodyText}">${html}</p>`
}

export function emailButton(label: string, href: string): string {
  // Bulletproof-ish black button (table cell carries the background for Outlook).
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 8px"><tr><td style="background:${B.ink}"><a href="${href}" style="display:inline-block;padding:11px 20px;font-family:${B.fontStack};font-size:13px;letter-spacing:0.3px;color:#ffffff;text-decoration:none">${label}</a></td></tr></table>`
}

export function emailDivider(): string {
  return `<div style="height:1px;line-height:1px;font-size:0;background:${B.hairline};margin:24px 0"></div>`
}

// Small uppercase tracked label — e.g. an order reference above a summary.
export function emailEyebrow(text: string): string {
  return `<div style="font-family:${B.fontStack};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${B.ink};margin:0 0 10px">${text}</div>`
}

/** One chosen print option, e.g. { label: 'Paper', value: 'Hahnemühle Photo Rag' }. */
export type EmailSpec = { label: string; value: string }

export type EmailLineItem = {
  title: string
  artist?: string
  /** The print options the buyer chose (size, paper, frame, edition…). */
  specs?: EmailSpec[]
  quantity: number
  /** Pre-formatted retail price for ONE unit, e.g. '€211.00'. */
  unitPrice?: string
  /** Pre-formatted retail price for the line (unit × quantity), e.g. '€422.00'. */
  lineTotal?: string
}

/** A row in the price breakdown below the items (Subtotal / Shipping / VAT / Total). */
export type EmailSummaryRow = { label: string; value: string; strong?: boolean }

// Renders an itemized receipt: each line shows the artwork, artist, the chosen
// options, quantity and price; the optional summary rows give the price
// breakdown (the `strong` row — Total — is emphasized).
export function emailLineItems(items: EmailLineItem[], summary?: EmailSummaryRow[]): string {
  const rows = items
    .map((it) => {
      const artist = it.artist
        ? `<div style="font-size:13px;color:${B.muted};margin-top:3px">${it.artist}</div>`
        : ''
      const specs = it.specs?.length
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px">${it.specs
            .map(
              (s) =>
                `<tr><td style="font-family:${B.fontStack};font-size:12px;line-height:1.5;color:${B.muted};padding:1px 14px 1px 0;vertical-align:top;white-space:nowrap">${s.label}</td><td style="font-family:${B.fontStack};font-size:12px;line-height:1.5;color:${B.valueText};padding:1px 0;vertical-align:top">${s.value}</td></tr>`,
            )
            .join('')}</table>`
        : ''
      // Right column: line total on top; unit price × qty beneath when more than
      // one, otherwise the quantity. Never empty, so a line never looks unfinished.
      let right: string
      if (it.lineTotal) {
        const sub =
          it.quantity > 1 && it.unitPrice
            ? `${it.quantity}&nbsp;×&nbsp;${it.unitPrice}`
            : `Qty&nbsp;${it.quantity}`
        right = `<div style="font-size:15px;font-weight:600;color:${B.ink}">${it.lineTotal}</div><div style="font-size:12px;color:${B.muted};margin-top:4px">${sub}</div>`
      } else {
        right = `<div style="font-size:13px;color:${B.muted}">Qty&nbsp;${it.quantity}</div>`
      }
      return `<tr><td style="padding:18px 0;border-bottom:1px solid ${B.hairline};vertical-align:top">
        <div style="font-size:15px;color:${B.ink};font-weight:600;line-height:1.3">${it.title}</div>${artist}${specs}
      </td><td style="padding:18px 0 18px 16px;border-bottom:1px solid ${B.hairline};text-align:right;white-space:nowrap;vertical-align:top">${right}</td></tr>`
    })
    .join('')
  const summaryRows = (summary ?? [])
    .map((r) => {
      const padTop = r.strong ? '16px' : '6px'
      const labelStyle = r.strong
        ? `font-size:14px;font-weight:700;color:${B.ink}`
        : `font-size:13px;color:${B.muted}`
      const valueStyle = r.strong
        ? `font-size:16px;font-weight:700;color:${B.ink}`
        : `font-size:13px;color:${B.valueText}`
      return `<tr><td style="padding:${padTop} 0 0;${labelStyle}">${r.label}</td><td style="padding:${padTop} 0 0 16px;text-align:right;white-space:nowrap;${valueStyle}">${r.value}</td></tr>`
    })
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${B.fontStack};margin:4px 0 16px">${rows}${summaryRows}</table>`
}
