import { EMAIL_BRAND, EMAIL_CONTACT } from './brand'

const B = EMAIL_BRAND

// One stacked contact line in the footer — value only, no label, with a little
// vertical breathing room between lines.
const contactLine = (value: string) =>
  `<div style="font-family:${B.fontStack};font-size:13px;line-height:1.5;color:${B.valueText};margin:0 0 6px">${value}</div>`

/**
 * Branded email header — a `<tr>` row for the content table: beige band with
 * the centered monogram. Reused by every email via {@link renderEmailLayout}.
 * Edit here once to change the header across all emails.
 */
export function emailHeader(): string {
  return `<tr><td align="center" style="background:${B.beige};border-bottom:1px solid ${B.hairline};padding:20px">
    <img src="${B.monogramUrl}" width="36" height="38" alt="The Art Room" style="display:block;border:0;outline:none">
  </td></tr>`
}

/**
 * Branded email footer — a `<tr>` row for the content table: wordmark + the
 * labelled contact signature. Reused by every email via {@link renderEmailLayout}.
 * Edit here once to change the footer across all emails.
 */
export function emailFooter(): string {
  return `<tr><td style="border-top:1px solid ${B.hairline};padding:24px 26px;text-align:left">
    <img src="${B.wordmarkUrl}" width="140" height="13" alt="The Art Room" style="display:block;border:0;outline:none">
    <div style="margin-top:16px">
      ${contactLine(EMAIL_CONTACT.mail)}
      ${contactLine(EMAIL_CONTACT.tel)}
      ${contactLine(EMAIL_CONTACT.web)}
    </div>
  </td></tr>`
}

/**
 * Composes the shared chrome ({@link emailHeader} + body + {@link emailFooter})
 * into the full HTML document. Every email renders through here so the header
 * and footer stay consistent and centrally editable.
 */
export function renderEmailLayout(input: { preheader: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0;padding:0;background:${B.pageBg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${input.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${B.pageBg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="${B.contentWidth}" cellpadding="0" cellspacing="0" style="width:${B.contentWidth}px;max-width:100%;background:#ffffff;border:1px solid ${B.hairline}">
  ${emailHeader()}
  <tr><td style="padding:28px 26px;text-align:left">${input.bodyHtml}</td></tr>
  ${emailFooter()}
</table>
</td></tr></table>
</body></html>`
}
