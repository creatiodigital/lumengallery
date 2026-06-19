import { EMAIL_BRAND, EMAIL_CONTACT } from './brand'

const B = EMAIL_BRAND

const sigRow = (label: string, value: string) =>
  `<tr><td style="font-family:${B.fontStack};font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${B.labelMuted};padding:2px 14px 2px 0;vertical-align:middle">${label}</td><td style="font-family:${B.fontStack};font-size:12px;color:${B.valueText}">${value}</td></tr>`

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
  <tr><td align="center" style="background:${B.beige};border-bottom:1px solid ${B.hairline};padding:20px">
    <img src="${B.monogramUrl}" width="36" height="38" alt="The Art Room" style="display:block;border:0;outline:none">
  </td></tr>
  <tr><td style="padding:28px 26px;text-align:left">${input.bodyHtml}</td></tr>
  <tr><td style="border-top:1px solid ${B.hairline};padding:24px 26px;text-align:left">
    <img src="${B.wordmarkUrl}" width="140" height="13" alt="The Art Room" style="display:block;border:0;outline:none">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px">
      ${sigRow('Mail', EMAIL_CONTACT.mail)}
      ${sigRow('Tel', EMAIL_CONTACT.tel)}
      ${sigRow('Web', EMAIL_CONTACT.web)}
    </table>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}
