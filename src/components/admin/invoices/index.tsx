'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { formatEuro } from '@/lib/print-providers/format'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

import { listInvoices, exportInvoiceRegisterCsv } from '@/app/admin/invoices/actions'
import type { InvoiceRow, InvoiceFilter } from '@/lib/invoices/queryInvoices'

// ── Date helpers ──────────────────────────────────────────────────────────────

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

// ── Year options for the filter select ───────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
// Show from 2026 (launch year) through to next year, so a fresh Jan always
// appears before any invoice is issued.
const YEAR_OPTIONS: number[] = []
for (let y = 2026; y <= CURRENT_YEAR + 1; y++) YEAR_OPTIONS.push(y)

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

// ── Shared select style — inline, consistent with admin rounded controls ──────

const SELECT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-dashboard), var(--font-dashboard-fallback)',
  fontSize: 13,
  padding: '6px 10px',
  border: '1px solid var(--color-border-default)',
  borderRadius: 6,
  background: 'var(--color-white)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  outline: 'none',
}

// ── Main component ────────────────────────────────────────────────────────────

export const AdminInvoices = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  // Filter state
  const [yearFilter, setYearFilter] = useState<number | undefined>(undefined)
  const [monthFilter, setMonthFilter] = useState<number | undefined>(undefined)
  const [clientFilter, setClientFilter] = useState('')

  // Data state
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Hide-voided toggle (view only — exports are unaffected)
  const [hideVoided, setHideVoided] = useState(false)

  // CSV export state
  const [exporting, setExporting] = useState(false)
  // ZIP export state
  const [zipping, setZipping] = useState(false)

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') router.push('/')
    }
  }, [sessionStatus, session, router])

  // ── Data loading ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const filter: InvoiceFilter = {}
    if (yearFilter != null) filter.year = yearFilter
    if (monthFilter != null) filter.month = monthFilter
    if (clientFilter.trim()) filter.client = clientFilter.trim()

    const res = await listInvoices(filter)
    if (res.ok) setInvoices(res.invoices)
    else setError(res.error)
    setLoading(false)
  }, [yearFilter, monthFilter, clientFilter])

  useEffect(() => {
    if (sessionStatus === 'authenticated') void load()
  }, [sessionStatus, load])

  // ── CSV export ──────────────────────────────────────────────────────────────
  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const filter: InvoiceFilter = {}
      if (yearFilter != null) filter.year = yearFilter
      if (monthFilter != null) filter.month = monthFilter
      if (clientFilter.trim()) filter.client = clientFilter.trim()

      const res = await exportInvoiceRegisterCsv(filter)
      if (!res.ok) {
        alert(`Export failed: ${res.error}`)
        return
      }
      // Trigger browser download via a temporary Blob URL.
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // ── ZIP export (all filtered invoice PDFs in one file) ────────────────────────
  const handleExportZip = async () => {
    setZipping(true)
    try {
      const params = new URLSearchParams()
      if (yearFilter != null) params.set('year', String(yearFilter))
      if (monthFilter != null) params.set('month', String(monthFilter))
      if (clientFilter.trim()) params.set('client', clientFilter.trim())

      const res = await fetch(`/admin/invoices/export/zip?${params.toString()}`)
      if (!res.ok) {
        alert(`ZIP export failed: ${await res.text()}`)
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const filename = disposition.match(/filename="(.+?)"/)?.[1] ?? 'AR-invoices.zip'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setZipping(false)
    }
  }

  // ── Derived view (hide-voided filtering — exports always use full `invoices`) ──
  const visibleInvoices = hideVoided
    ? invoices.filter((inv) => !inv.voided && inv.type !== 'credit_note')
    : invoices

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout backLink="/admin/dashboard" backLabel="← Back to Admin Dashboard">
      <h1 className={dashboardStyles.pageTitle}>Invoice Register</h1>

      {error && (
        <div className={dashboardStyles.section}>
          <p className={dashboardStyles.sectionDescription}>⚠️ {error}</p>
        </div>
      )}

      {/* Filters */}
      <div className={dashboardStyles.section}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 12,
          }}
        >
          {/* Year select */}
          <div>
            <label
              htmlFor="invoice-year"
              style={{
                display: 'block',
                fontFamily: 'var(--font-dashboard), var(--font-dashboard-fallback)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                marginBottom: 4,
              }}
            >
              Year
            </label>
            <select
              id="invoice-year"
              style={SELECT_STYLE}
              value={yearFilter ?? ''}
              onChange={(e) => {
                const next = e.target.value ? Number(e.target.value) : undefined
                setYearFilter(next)
                // Month depends on year: clearing the year must clear the
                // month too, or a disabled-but-still-applied month silently
                // filters the register AND both exports.
                if (next == null) setMonthFilter(undefined)
              }}
            >
              <option value="">All years</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Month select — only enabled when a year is selected */}
          <div>
            <label
              htmlFor="invoice-month"
              style={{
                display: 'block',
                fontFamily: 'var(--font-dashboard), var(--font-dashboard-fallback)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                marginBottom: 4,
              }}
            >
              Month
            </label>
            <select
              id="invoice-month"
              style={{
                ...SELECT_STYLE,
                opacity: yearFilter == null ? 0.5 : 1,
              }}
              value={monthFilter ?? ''}
              disabled={yearFilter == null}
              onChange={(e) =>
                setMonthFilter(e.target.value ? Number(e.target.value) : undefined)
              }
            >
              <option value="">All months</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Client search */}
          <div>
            <label
              htmlFor="invoice-client"
              style={{
                display: 'block',
                fontFamily: 'var(--font-dashboard), var(--font-dashboard-fallback)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                marginBottom: 4,
              }}
            >
              Client
            </label>
            <Input
              id="invoice-client"
              type="text"
              placeholder="Search by name or email…"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            />
          </div>

          {/* Clear filters */}
          {(yearFilter != null || monthFilter != null || clientFilter) && (
            <Button
              variant="ghost"
              size="small"
              font="dashboard"
              onClick={() => {
                setYearFilter(undefined)
                setMonthFilter(undefined)
                setClientFilter('')
              }}
            >
              Clear filters
            </Button>
          )}

          {/* Hide-voided toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
            <input
              id="hide-voided"
              type="checkbox"
              checked={hideVoided}
              onChange={(e) => setHideVoided(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label
              htmlFor="hide-voided"
              style={{
                fontFamily: 'var(--font-dashboard), var(--font-dashboard-fallback)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Hide voided invoices
            </label>
          </div>
        </div>
        {hideVoided && (
          <p
            style={{
              marginTop: 8,
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-dashboard), var(--font-dashboard-fallback)',
            }}
          >
            Exports always include voided invoices and their credit notes (they net to zero).
          </p>
        )}
      </div>

      {/* Register table */}
      <div className={dashboardStyles.section}>
        {/* Top bar: export actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {/* CSV export */}
          <Button
            variant="secondary"
            size="small"
            font="dashboard"
            disabled={exporting || loading || invoices.length === 0}
            onClick={() => void handleExportCsv()}
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>

          {/* ZIP export — bundles the currently-filtered invoice PDFs. */}
          <Button
            variant="secondary"
            size="small"
            font="dashboard"
            disabled={zipping || loading || invoices.length === 0}
            onClick={() => void handleExportZip()}
          >
            {zipping ? 'Zipping…' : 'Export PDFs (ZIP)'}
          </Button>
        </div>

        {(() => {
          if (loading) {
            return (
              <p className={dashboardStyles.sectionDescription}>Loading…</p>
            )
          }
          if (invoices.length === 0) {
            return (
              <EmptyState
                message={
                  yearFilter != null || monthFilter != null || clientFilter
                    ? 'No invoices match the current filters.'
                    : 'No invoices yet.'
                }
              />
            )
          }
          if (visibleInvoices.length === 0) {
            return (
              <EmptyState message="All invoices are voided and hidden. Uncheck 'Hide voided' to see them." />
            )
          }
          return (
            <table className={dashboardStyles.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th style={{ textAlign: 'right' }}>Base</th>
                  <th style={{ textAlign: 'right' }}>VAT</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>{/* action */}</th>
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{inv.number}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {inv.type === 'invoice' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          Invoice
                          {inv.voided && inv.rectifiedByNumber && (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 4,
                                background: 'var(--color-badge-danger-bg)',
                                color: 'var(--color-badge-danger-text)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Voided → {inv.rectifiedByNumber}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)' }}>Credit note</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(inv.issuedAt)}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{inv.buyerName}</div>
                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          opacity: 0.7,
                          marginTop: 2,
                        }}
                      >
                        {inv.buyerEmail}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatEuro(inv.baseCents)}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatEuro(inv.vatCents)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                      }}
                    >
                      {formatEuro(inv.totalCents)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        variant="secondary"
                        size="small"
                        font="dashboard"
                        href={`/admin/invoices/${inv.id}/download`}
                      >
                        View / download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })()}
      </div>
    </DashboardLayout>
  )
}
