'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { SelectDropdown, type SelectOption } from '@/components/ui/SelectDropdown'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

import {
  createDashboardLink,
  createOnboardingLink,
  disconnectAccount,
  getConnectCountries,
  getPayoutsStatus,
  type ConnectCountry,
  type PayoutsStatus,
} from '@/app/dashboard/payouts/actions'

export const PayoutsPage = () => {
  const searchParams = useSearchParams()
  const justOnboarded = searchParams.get('onboarded') === '1'

  const [status, setStatus] = useState<PayoutsStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [country, setCountry] = useState<string>('')
  const [countries, setCountries] = useState<ConnectCountry[]>([])
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const res = await getPayoutsStatus()
    if (res.ok) {
      setStatus(res.status)
    } else {
      setError(res.error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Countries come straight from Stripe's country_specs API (cached 24h
  // server-side) so this list never drifts from what `accounts.create`
  // will actually accept.
  useEffect(() => {
    let cancelled = false
    getConnectCountries().then((res) => {
      if (cancelled) return
      if (res.ok) setCountries(res.countries)
      else setError(res.error)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleConnect = useCallback(async () => {
    // If the artist already has a Connect account, country is locked and we
    // just need a fresh onboarding link — no country required from UI.
    // Otherwise we must pass the picker value.
    if (!status?.connected && !country) {
      setError('Please select your country first.')
      return
    }
    setWorking(true)
    setError(null)
    const res = await createOnboardingLink(status?.connected ? undefined : country)
    if (res.ok) {
      window.location.href = res.url
      return
    }
    setError(res.error)
    setWorking(false)
  }, [country, status?.connected])

  const handleOpenStripe = useCallback(async () => {
    setWorking(true)
    setError(null)
    const res = await createDashboardLink()
    if (res.ok) {
      window.open(res.url, '_blank', 'noopener,noreferrer')
    } else {
      setError(res.error)
    }
    setWorking(false)
  }, [])

  const performDisconnect = useCallback(async () => {
    setWorking(true)
    setError(null)
    const res = await disconnectAccount()
    if (!res.ok) {
      setError(res.error)
      setWorking(false)
      return
    }
    if (res.pendingOrders > 0) {
      setError(
        `Disconnected. Heads-up: you had ${res.pendingOrders} order(s) awaiting payout — ` +
          `reconnect to receive them.`,
      )
    }
    await load()
    setConfirmingDisconnect(false)
    setWorking(false)
  }, [load])

  return (
    <DashboardLayout backLink="/dashboard">
      <h1 className={dashboardStyles.pageTitle}>Payouts</h1>

      {loading && (
        <div className={dashboardStyles.section}>
          <p className={dashboardStyles.sectionDescription}>Loading…</p>
        </div>
      )}

      {!loading && status && (
        <>
          <div className={dashboardStyles.section}>
            <div className={dashboardStyles.sectionHeader}>
              <h2 className={dashboardStyles.sectionTitle}>
                {statusHeadline(status, justOnboarded)}
              </h2>
              {renderPrimaryAction({ status, working, handleConnect, handleOpenStripe })}
            </div>
            <p className={dashboardStyles.sectionDescription}>{statusBody(status)}</p>

            {!status.connected && (
              <div style={{ marginTop: 'var(--space-4)', maxWidth: 320 }}>
                <label
                  className={dashboardStyles.sectionDescription}
                  style={{ display: 'block', marginBottom: 'var(--space-1)' }}
                >
                  Your country (where your bank account is)
                </label>
                <SelectDropdown<string>
                  disabled={countries.length === 0}
                  value={country}
                  onChange={(v) => setCountry(v)}
                  placeholder={countries.length === 0 ? 'Loading countries…' : 'Select a country…'}
                  options={countries.map<SelectOption<string>>((c) => ({
                    value: c.code,
                    label: c.name,
                  }))}
                />
                <span
                  className={dashboardStyles.sectionDescription}
                  style={{ display: 'block', marginTop: 'var(--space-1)' }}
                >
                  This can&apos;t be changed later — pick the country your bank account is in.
                </span>
              </div>
            )}
          </div>

          {status.connected && !status.onboardingComplete && (
            <div className={dashboardStyles.section}>
              <p className={dashboardStyles.sectionDescription}>
                Stripe updates us in the background once onboarding is complete. If this page still
                says &quot;in progress&quot; after a minute, click{' '}
                <Button
                  variant="ghost"
                  onClick={load}
                  label="refresh"
                  style={{
                    padding: 0,
                    textDecoration: 'underline',
                    color: 'inherit',
                    font: 'inherit',
                  }}
                />
                .
              </p>
            </div>
          )}

          {status.connected && (
            <div className={dashboardStyles.section}>
              <div className={dashboardStyles.sectionHeader}>
                <h2 className={dashboardStyles.sectionTitle}>Disconnect</h2>
                <Button
                  font="dashboard"
                  variant="secondary"
                  label={working ? 'Disconnecting\u2026' : 'Disconnect Stripe'}
                  onClick={() => setConfirmingDisconnect(true)}
                  disabled={working}
                />
              </div>
              <p className={dashboardStyles.sectionDescription}>
                Removes your bank details from Stripe. You can reconnect anytime — useful if you
                need to switch country or bank.
              </p>
            </div>
          )}
        </>
      )}

      {error && (
        <div className={dashboardStyles.section}>
          <p className={dashboardStyles.sectionDescription}>⚠️ {error}</p>
        </div>
      )}

      {confirmingDisconnect && (
        <ConfirmModal
          title="Disconnect your Stripe account?"
          message={
            <>
              {
                'Your bank details will be removed from Stripe and you’ll have to complete onboarding again if you reconnect. Any shipped orders that haven’t been paid out yet will need a new account to receive their payout.'
              }
            </>
          }
          confirmLabel="Disconnect"
          destructive
          busy={working}
          onConfirm={performDisconnect}
          onCancel={() => setConfirmingDisconnect(false)}
        />
      )}
    </DashboardLayout>
  )
}

function statusHeadline(s: PayoutsStatus, justOnboarded: boolean) {
  if (!s.connected) return 'Not connected yet'
  if (s.payoutsEnabled && s.detailsSubmitted) return 'Payouts active'
  if (justOnboarded) return 'Finishing setup…'
  return 'Onboarding in progress'
}

function statusBody(s: PayoutsStatus) {
  if (!s.connected) {
    return 'Connect a bank account with Stripe so we can send you your share when your prints sell. Stripe handles identity verification and local banking — we never see your card or bank details.'
  }
  if (s.payoutsEnabled && s.detailsSubmitted) {
    return `You&apos;re all set. Payouts go to the bank account on file with Stripe${
      s.email ? ` (${s.email})` : ''
    }. You can update details from the Stripe dashboard.`
  }
  return 'Stripe still needs a few more details from you. Continue where you left off to finish setup.'
}

function renderPrimaryAction({
  status,
  working,
  handleConnect,
  handleOpenStripe,
}: {
  status: PayoutsStatus
  working: boolean
  handleConnect: () => void
  handleOpenStripe: () => void
}) {
  if (!status.connected) {
    return (
      <Button
        font="dashboard"
        variant="primary"
        label={working ? 'Opening Stripe…' : 'Connect with Stripe'}
        onClick={handleConnect}
        disabled={working}
      />
    )
  }
  if (status.payoutsEnabled && status.detailsSubmitted) {
    return (
      <Button
        font="dashboard"
        variant="secondary"
        label={working ? 'Opening…' : 'Open Stripe dashboard'}
        onClick={handleOpenStripe}
        disabled={working}
      />
    )
  }
  return (
    <Button
      font="dashboard"
      variant="primary"
      label={working ? 'Opening Stripe…' : 'Continue setup'}
      onClick={handleConnect}
      disabled={working}
    />
  )
}
