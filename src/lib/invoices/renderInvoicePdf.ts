/**
 * AR-131 — Render an Invoice or Credit Note to a PDF buffer.
 *
 * Usage:
 *   const buffer = await renderInvoicePdf(invoiceData)
 *   // → Buffer starting with '%PDF-'
 */

import { createElement, type ReactElement } from 'react'

import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'

import { InvoiceDocument } from './InvoiceDocument'
import type { InvoiceDocumentProps } from './InvoiceDocument'

export type { InvoiceDocumentProps as RenderInput }

export async function renderInvoicePdf(input: InvoiceDocumentProps): Promise<Buffer> {
  // createElement produces the correct ReactElement at runtime; the cast
  // satisfies @react-pdf/renderer's renderToBuffer type signature which
  // expects ReactElement<DocumentProps> (the inner Document component's props).
  const element = createElement(InvoiceDocument, input) as ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)
  return Buffer.from(buffer)
}
