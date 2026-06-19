import { EMAIL_BRAND } from './brand'

const B = EMAIL_BRAND

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

export type EmailLineItem = {
  title: string
  artist?: string
  specs?: string[]
  qty: number
  price?: string
}

export function emailLineItems(
  items: EmailLineItem[],
  total?: { label: string; value: string },
): string {
  const rows = items
    .map((it) => {
      const specs = it.specs?.length
        ? `<div style="font-size:12px;color:${B.muted};line-height:1.6;margin-top:4px">${it.specs.join('<br>')}</div>`
        : ''
      const artist = it.artist
        ? `<div style="font-size:12px;color:${B.muted};margin-top:2px">${it.artist}</div>`
        : ''
      return `<tr><td style="padding:14px 0;border-bottom:1px solid ${B.hairline};vertical-align:top">
        <div style="font-size:14px;color:${B.ink};font-weight:600">${it.title}</div>${artist}${specs}
        ${it.qty > 1 ? `<div style="font-size:12px;color:${B.muted};margin-top:4px">Qty: ${it.qty}</div>` : ''}
      </td><td style="padding:14px 0;border-bottom:1px solid ${B.hairline};text-align:right;white-space:nowrap;font-size:14px;color:${B.ink}">${it.price ?? ''}</td></tr>`
    })
    .join('')
  const totalRow = total
    ? `<tr><td style="padding:14px 0;font-size:14px;font-weight:700;color:${B.ink}">${total.label}</td><td style="padding:14px 0;text-align:right;font-size:14px;font-weight:700;color:${B.ink}">${total.value}</td></tr>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${B.fontStack};margin:8px 0 16px">${rows}${totalRow}</table>`
}
