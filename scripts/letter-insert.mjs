/**
 * Collector letter insert — the printed note that ships in every parcel.
 *
 * The print lab charges per letter and prints it as supplied, so this is a
 * standalone one-page A4 PDF, deliberately ARTWORK-AGNOSTIC: one file covers
 * every order, and nothing here names an artwork, a buyer or the lab.
 *
 * Brand system is shared with the invoice PDF (src/lib/invoices/InvoiceDocument.tsx):
 * same Lora face, same colour tokens, same wordmark/monogram assets. Body text
 * is Lora rather than Manrope — this is a letter, not a document, and the serif
 * carries the warmer register.
 *
 * Run from the repo root:
 *   node scripts/letter-insert.mjs [outputPath]
 *
 * Default output: ~/Desktop/the-art-room-letter-insert.pdf
 *
 * Plain .mjs with React.createElement rather than TSX, so it runs on bare node
 * with no build step or extra dev dependency.
 */

import path from 'path'
import os from 'os'
import { createElement as h } from 'react'
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToFile } from '@react-pdf/renderer'

const fontDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Lora',
  fonts: [
    { src: path.join(fontDir, 'lora-regular.ttf'), fontWeight: 'normal', fontStyle: 'normal' },
    { src: path.join(fontDir, 'lora-bold.ttf'), fontWeight: 'bold', fontStyle: 'normal' },
    { src: path.join(fontDir, 'lora-italic.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
  ],
})

Font.register({
  family: 'Manrope',
  fonts: [{ src: path.join(fontDir, 'manrope-regular.ttf'), fontWeight: 'normal', fontStyle: 'normal' }],
})

// Hyphenation off — react-pdf otherwise breaks words mid-line, which reads as
// a typo in a hand-signed-feeling letter.
Font.registerHyphenationCallback((word) => [word])

// Mirrors BRAND in InvoiceDocument.tsx.
const BRAND = {
  red: '#bd1622',
  ink: '#111111',
  bodyText: '#333333',
  muted: '#595959',
}

const WORDMARK_PATH = path.join(process.cwd(), 'public', 'email', 'wordmark@2x.png')
const MONOGRAM_PATH = path.join(process.cwd(), 'public', 'email', 'monogram@2x.png')

const WEBSITE = 'THEARTROOM.GALLERY'

const BODY = [
  'Thank you for placing your trust in The Art Room.',
  'Welcoming a work of art into your home is a personal and meaningful act, and we are truly honored that you have chosen to make this piece part of your life.',
  'At The Art Room, every work is thoughtfully curated and selected directly with the artists we represent. We believe in taking the time to discover exceptional work, to understand the vision behind it, and to share pieces that we genuinely believe deserve to be seen, lived with, and cherished.',
  'This artwork was chosen because it moved us. We hope that, over time, it becomes something equally meaningful to you—something that brings character to your space, sparks a memory, or simply gives you a moment of pleasure each time you see it.',
  'Thank you for supporting independent artists and for being part of The Art Room. We are delighted to have you as a collector.',
  'If you would ever like to know more about this work, its artist, or the story behind it, please write to us. We are always happy to hear from you.',
]

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Lora',
    fontSize: 10.5,
    lineHeight: 1.75,
    color: BRAND.bodyText,
    backgroundColor: '#ffffff',
    paddingTop: 58,
    paddingHorizontal: 68,
    // Room for the fixed footer.
    paddingBottom: 108,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  wordmark: {
    width: 150,
    height: 'auto',
  },
  salutation: {
    fontSize: 12,
    color: BRAND.ink,
    marginBottom: 16,
  },
  paragraph: {
    marginBottom: 12,
    textAlign: 'left',
  },
  signOff: {
    marginTop: 18,
  },
  signOffLead: {
    marginBottom: 2,
  },
  signOffName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: BRAND.ink,
  },
  footer: {
    position: 'absolute',
    bottom: 44,
    left: 68,
    right: 68,
    alignItems: 'center',
  },
  // The one accent on the page — same red as the invoice divider.
  footerRule: {
    width: 44,
    height: 1,
    backgroundColor: BRAND.red,
    marginBottom: 16,
  },
  footerMonogram: {
    width: 26,
    height: 'auto',
    marginBottom: 10,
  },
  footerWebsite: {
    fontFamily: 'Manrope',
    fontSize: 7,
    letterSpacing: 1.1,
    color: BRAND.muted,
    textAlign: 'center',
  },
})

const Letter = () =>
  h(
    Document,
    { title: 'The Art Room — A note for the collector', author: 'The Art Room Gallery SL' },
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(View, { style: styles.header }, h(Image, { src: WORDMARK_PATH, style: styles.wordmark })),
      h(Text, { style: styles.salutation }, 'Dear Collector,'),
      ...BODY.map((para, i) => h(Text, { key: `p${i}`, style: styles.paragraph }, para)),
      h(
        View,
        { style: styles.signOff },
        h(Text, { style: styles.signOffLead }, 'With gratitude,'),
        h(Text, { style: styles.signOffName }, 'The Art Room'),
      ),
      h(
        View,
        { style: styles.footer, fixed: true },
        h(View, { style: styles.footerRule }),
        h(Image, { src: MONOGRAM_PATH, style: styles.footerMonogram }),
        h(Text, { style: styles.footerWebsite }, WEBSITE),
      ),
    ),
  )

const out = process.argv[2] ?? path.join(os.homedir(), 'Desktop', 'the-art-room-letter-insert.pdf')

await renderToFile(h(Letter), out)
console.log(`Wrote ${out}`)
