# Print inserts

Physical material that ships inside a parcel. **Not web assets** — deliberately outside
`public/` so nothing here is servable from the app origin.

## collector-letter.pdf

The branded note that goes in every print order. Uploaded to the print provider's portal
once, then printed per order (they charge per letter).

Deliberately **artwork-agnostic**: it names no artwork, no artist, no buyer and no
provider, so one file covers every order and never needs reissuing.

- A4, single page
- Wordmark centred at the top, monogram centred in the footer above the website
- Lora throughout (the invoice PDF uses Manrope for body copy; a letter reads warmer in
  the serif), Manrope only for the footer website line
- Shares its colour tokens and brand assets with `src/lib/invoices/InvoiceDocument.tsx`

### Regenerating

From the repo root:

```
node scripts/letter-insert.mjs assets/print-inserts/collector-letter.pdf
```

Edit the copy in `scripts/letter-insert.mjs` (the `BODY` array), regenerate, and commit
both the script and the PDF. **Keep the generated PDF committed** — an earlier version of
this letter lived only in a scratch directory and on a Desktop, and was lost.

Verify after regenerating — the text is written as glyph indices in subset fonts, so
`grep` finds nothing. Use PDFKit:

```
swift -e 'import PDFKit; print(PDFDocument(url: URL(fileURLWithPath: "assets/print-inserts/collector-letter.pdf"))!.string!)'
```

It must come out one page. Two pages means the copy grew past the frame — shorten it or
reduce `fontSize` / `lineHeight` in the script rather than letting it spill.
