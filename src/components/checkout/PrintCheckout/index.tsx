'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { SelectDropdown, type SelectOption } from '@/components/ui/SelectDropdown'
import Logo from '@/icons/logo.svg'
import {
  type ProviderId,
  type Quote,
  type SpecsSummary,
  type WizardConfig,
  formatEuro,
} from '@/lib/print-providers'
import { DIAL_CODES, getCountryName } from '@/lib/print-providers/dialCodes'
import { getProviderQuote } from '@/lib/print-providers/quote'

import { OrderSummary } from '../OrderSummary'
import { clearPrintSession } from '../clearPrintSession'

import { createPaymentIntent } from './createPaymentIntent'

import styles from './PrintCheckout.module.scss'

// Country names come from a static map (COUNTRY_NAMES in dialCodes.ts)
// rather than Intl.DisplayNames. Reason: Node and Chrome ship different
// ICU data for politically-sensitive regions (e.g. FK), so the SSR
// option text disagrees with the CSR option text and React throws a
// hydration mismatch. Static map => identical strings on both sides.
const sortCountries = (codes: string[]) =>
  [...codes].sort((a, b) => getCountryName(a).localeCompare(getCountryName(b)))

export type CheckoutArtwork = {
  slug: string
  title: string
  artistName: string
  year?: string
  imageUrl: string
  originalWidthPx: number
  originalHeightPx: number
  printPriceCents: number
}

interface PrintCheckoutProps {
  artwork: CheckoutArtwork
  /** Server-authoritative provider for this artwork — used to dispatch
   *  quote calls and the server-side payment intent. */
  providerId: ProviderId
  /** ISO codes the catalog can ship to — drives the country dropdown. */
  supportedCountries: string[]
  /** Pre-filled country (e.g. when the buyer comes back from payment). */
  initialCountry: string
}

type AddressForm = {
  fullName: string
  email: string
  phone: string
  countryCode: string
  address1: string
  address2: string
  city: string
  stateOrRegion: string
  postalCode: string
}

type ShippingFieldName =
  | 'country'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'address1'
  | 'city'
  | 'postalCode'

type ShippingErrors = Partial<Record<ShippingFieldName, string>>

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validateShippingField = (name: ShippingFieldName, value: string): string | undefined => {
  const trimmed = value.trim()
  switch (name) {
    case 'country':
      if (!trimmed) return 'Please choose a country.'
      return
    case 'fullName':
      if (trimmed.length < 2) return 'Please enter your full name.'
      return
    case 'email':
      if (!emailRegex.test(trimmed)) return 'Please enter a valid email address.'
      return
    case 'phone': {
      const digits = trimmed.replace(/\D/g, '')
      if (digits.length < 8) return 'Please enter a valid phone number.'
      if (/^(\d)\1+$/.test(digits)) return 'Please enter a valid phone number.'
      return
    }
    case 'address1':
      if (trimmed.length < 3) return 'Please enter your street address.'
      return
    case 'city':
      if (trimmed.length < 2) return 'Please enter a city.'
      return
    case 'postalCode':
      if (trimmed.length < 3 || !/\d/.test(trimmed)) {
        return 'Please enter a valid postal code.'
      }
      return
  }
}

/** Shape of the wizard → checkout/payment handoff stash. */
type WizardHandoff = {
  providerId: ProviderId
  config: WizardConfig
  country: string
  quote: Quote
  specs: SpecsSummary
}

export const PrintCheckout = ({
  artwork,
  providerId,
  supportedCountries,
  initialCountry,
}: PrintCheckoutProps) => {
  const router = useRouter()
  const [country, setCountry] = useState<string>(initialCountry)

  // Read any previously-typed shipping form (sessionStorage) synchronously
  // on first render so useState below seeds from it. Doing this in an
  // effect after mount races with the save effect, which fires on mount
  // with empty initial state and wipes the stored values before they can
  // be restored.
  const storageKey = `print-address:${artwork.slug}`
  const initialAddress = useMemo<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = sessionStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch {
      return {}
    }
  }, [storageKey])

  // Controlled shipping-address state — modern Chrome/Safari autofill
  // dispatches a synthetic `input` event that React picks up via
  // onChange, so we get the autofill value into state without any
  // special handling.
  const [fullName, setFullName] = useState(initialAddress.fullName ?? '')
  const [emailField, setEmailField] = useState(initialAddress.email ?? '')
  const [phoneField, setPhoneField] = useState(initialAddress.phone ?? '')
  const [address1, setAddress1] = useState(initialAddress.address1 ?? '')
  const [address2, setAddress2] = useState(initialAddress.address2 ?? '')
  const [city, setCity] = useState(initialAddress.city ?? '')
  const [stateOrRegion, setStateOrRegion] = useState(initialAddress.state ?? '')
  const [postalCode, setPostalCode] = useState(initialAddress.postalCode ?? '')
  // Independent of `country` by design — a buyer might keep a foreign
  // phone after relocating or be sending a gift to another country. We
  // seed it from the initial shipping country (best guess) but never
  // auto-sync after that; the buyer owns the choice.
  const [phoneDial, setPhoneDial] = useState<string>(
    () => DIAL_CODES[initialCountry] ?? DIAL_CODES.ES,
  )
  const [handoff, setHandoff] = useState<WizardHandoff | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const countryOptions: SelectOption<string>[] = useMemo(
    () =>
      sortCountries(supportedCountries).map((code) => ({
        value: code,
        label: getCountryName(code),
      })),
    [supportedCountries],
  )

  // Phone-prefix options: unique dial codes only (many countries share
  // a prefix — e.g. +1 covers US/CA/Caribbean — and the digits a buyer
  // types work the same regardless), sorted numerically. Independent
  // of `supportedCountries`: the buyer's phone can be from anywhere.
  const phoneDialOptions: SelectOption<string>[] = useMemo(() => {
    const unique = Array.from(new Set(Object.values(DIAL_CODES)))
    return unique
      .sort((a, b) => Number(a) - Number(b))
      .map((dial) => ({ value: dial, label: `+${dial}` }))
  }, [])
  // Validation errors keyed by field name. Populated only after the
  // first submit attempt; cleared/updated as the user fixes each field.
  const [errors, setErrors] = useState<ShippingErrors>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // Re-validate one field as the user edits it after the first failed
  // submit so the error message clears in place once they fix it.
  const handleFieldChange = (name: ShippingFieldName, value: string) => {
    if (!submitAttempted) return
    if (!(name in errors)) return
    setErrors((prev) => ({ ...prev, [name]: validateShippingField(name, value) }))
  }

  // Persist the form snapshot whenever any shipping field changes so the
  // buyer doesn't lose what they typed if they bounce back to the wizard.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          fullName,
          email: emailField,
          phone: phoneField,
          address1,
          address2,
          city,
          state: stateOrRegion,
          postalCode,
        }),
      )
    } catch {
      // sessionStorage can be disabled/full — non-fatal, we just lose persistence.
    }
  }, [
    storageKey,
    fullName,
    emailField,
    phoneField,
    address1,
    address2,
    city,
    stateOrRegion,
    postalCode,
  ])

  const fieldProps = (name: ShippingFieldName) => ({
    'data-error': errors[name] ? 'true' : 'false',
  })

  const handleClose = () => {
    clearPrintSession(artwork.slug)
    router.push('/prints')
  }

  const backToWizard = () => {
    // Forward every wizard option back into the URL so the wizard
    // re-hydrates the buyer's exact selection. Country is intentionally
    // omitted — it lives on the checkout step now, not the wizard.
    const params = new URLSearchParams()
    if (handoff) {
      for (const [key, value] of Object.entries(handoff.config.values)) {
        params.set(key, value)
      }
      if (handoff.config.customSize) {
        params.set(
          'customSize',
          `${handoff.config.customSize.widthCm}x${handoff.config.customSize.heightCm}`,
        )
      }
      if (handoff.config.borders) {
        for (const [borderId, b] of Object.entries(handoff.config.borders)) {
          params.set(borderId, String(b.allCm))
        }
      }
    }
    params.set('provider', providerId)
    router.push(`/artworks/${artwork.slug}/print?${params.toString()}`)
  }

  // Read the wizard's stash on mount. The wizard hands off without a
  // country (country is picked here), so we don't validate against
  // country any more — just (artwork slug, providerId). If the stash
  // happens to have a country (buyer picked one and bounced back +
  // forth) seed our local state from it.
  useEffect(() => {
    const stash = readHandoff(artwork.slug, providerId)
    if (stash) {
      setHandoff(stash)
      setQuoteError(null)
      if (stash.country && !country) setCountry(stash.country)
      return
    }
    // No usable stash — buyer arrived via a stale URL or different
    // tab. Bounce to the wizard so they can reconfigure.
    setQuoteError('Your selection expired. Please reconfigure your print.')
    backToWizard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artwork.slug, providerId])

  // Persist the picked country back into the wizard handoff stash so
  // navigating back to the wizard pre-fills "Shipping to" and shows
  // the real shipping line instead of dashes.
  useEffect(() => {
    if (!handoff) return
    try {
      sessionStorage.setItem(
        `print-quote:${artwork.slug}`,
        JSON.stringify({ ...handoff, country, quote: quote ?? handoff.quote }),
      )
    } catch {
      // sessionStorage can be disabled/full — non-fatal.
    }
  }, [handoff, country, quote, artwork.slug])

  // Re-quote on every (config, country) change. When `country` is
  // empty, the server returns only the artwork line — shipping and
  // tax show "—" in the summary until the buyer picks a destination.
  useEffect(() => {
    if (!handoff) return
    let cancelled = false
    setQuoteLoading(true)

    getProviderQuote(handoff.providerId, {
      config: handoff.config,
      country,
      artistPriceCents: artwork.printPriceCents,
    })
      .then((next) => {
        if (cancelled) return
        setQuote(next)
        setQuoteLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[PrintCheckout] live quote failed:', err)
        setQuote(null)
        setQuoteLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [handoff, country, artwork.printPriceCents])

  const specs: SpecsSummary = handoff?.specs ?? []
  const orientation: 'portrait' | 'landscape' =
    handoff?.config.values.orientation === 'landscape' ? 'landscape' : 'portrait'

  const canSubmit = !!quote && !quoteLoading && !!handoff

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!handoff) return

    setSubmitAttempted(true)
    const fieldValues: Record<ShippingFieldName, string> = {
      country,
      fullName,
      email: emailField,
      phone: phoneField,
      address1,
      city,
      postalCode,
    }
    const newErrors: ShippingErrors = {}
    for (const name of Object.keys(fieldValues) as ShippingFieldName[]) {
      const err = validateShippingField(name, fieldValues[name])
      if (err) newErrors[name] = err
    }
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    // Combine the dial-code dropdown choice with the digits the buyer
    // typed. Server gets a single E.164-ish string ("+34 612345678")
    // it can pass straight to TPS / show in admin orders.
    const rawPhone = phoneField.trim()
    const phoneCombined = rawPhone && phoneDial ? `+${phoneDial} ${rawPhone}` : rawPhone
    const submitted: AddressForm = {
      fullName: fullName.trim(),
      email: emailField.trim(),
      phone: phoneCombined,
      countryCode: country,
      address1: address1.trim(),
      address2: address2.trim(),
      city: city.trim(),
      stateOrRegion: stateOrRegion.trim(),
      postalCode: postalCode.trim(),
    }

    setSubmitError(null)
    setSubmitting(true)
    try {
      const res = await createPaymentIntent({
        artworkSlug: artwork.slug,
        providerId: handoff.providerId,
        config: handoff.config,
        address: submitted,
      })
      if (!res.ok) {
        setSubmitError(res.error)
        return
      }
      // Stash what the payment page needs. The clientSecret is scoped to
      // this browser session; the address + totals are just so the
      // payment screen can render without re-fetching.
      sessionStorage.setItem(
        `print-payment:${artwork.slug}`,
        JSON.stringify({
          clientSecret: res.clientSecret,
          paymentIntentId: res.paymentIntentId,
          totals: res.totals,
          address: submitted,
          providerId: handoff.providerId,
          config: handoff.config,
          specs: handoff.specs,
          country,
        }),
      )
      const params = new URLSearchParams({ country, provider: handoff.providerId })
      router.push(`/artworks/${artwork.slug}/print/payment?${params.toString()}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.checkout}>
      <header className={styles.header}>
        <Link href="/" aria-label="Go to home" className={styles.logoLink}>
          <Logo className={styles.logo} />
        </Link>
        <span />
        <Button
          variant="ghost"
          onClick={handleClose}
          label="CLOSE"
          iconRight={<Icon name="close" size={16} />}
          className={styles.closeButton}
          aria-label="Close checkout"
        />
      </header>

      <main className={styles.body}>
        <form className={styles.formPanel} onSubmit={handleSubmit}>
          <h2 className={styles.formSectionTitle}>Where should we send it?</h2>

          <div className={`${styles.field} ${styles.fieldFull}`} {...fieldProps('country')}>
            <label className={styles.fieldLabel} htmlFor="country">
              Country
            </label>
            <SelectDropdown<string>
              options={countryOptions}
              value={country}
              onChange={(next) => {
                setCountry(next)
                if (submitAttempted) {
                  setErrors((prev) => ({
                    ...prev,
                    country: validateShippingField('country', next),
                  }))
                }
              }}
              placeholder="Choose a country…"
            />
            <span className={styles.fieldError}>Please choose a country.</span>
          </div>

          <div className={styles.fieldGrid}>
            <div className={`${styles.field} ${styles.fieldFull}`} {...fieldProps('fullName')}>
              <label className={styles.fieldLabel} htmlFor="fullName">
                Full name
              </label>
              <Input
                id="fullName"
                name="fullName"
                size="bare"
                inputClassName={styles.fieldInput}
                type="text"
                autoComplete="name"
                required
                maxLength={200}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  handleFieldChange('fullName', e.target.value)
                }}
              />
              <span className={styles.fieldError}>Please enter your full name.</span>
            </div>

            <div className={styles.field} {...fieldProps('email')}>
              <label className={styles.fieldLabel} htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                name="email"
                size="bare"
                inputClassName={styles.fieldInput}
                type="email"
                autoComplete="email"
                required
                maxLength={200}
                value={emailField}
                onChange={(e) => {
                  setEmailField(e.target.value)
                  handleFieldChange('email', e.target.value)
                }}
              />
              <span className={styles.fieldError}>Please enter a valid email address.</span>
            </div>

            <div className={styles.field} {...fieldProps('phone')}>
              <label className={styles.fieldLabel} htmlFor="phone">
                Phone (for carrier)
              </label>
              <div className={styles.phoneRow}>
                <SelectDropdown<string>
                  className={styles.phoneDial}
                  options={phoneDialOptions}
                  value={phoneDial}
                  onChange={setPhoneDial}
                />
                <div className={styles.phoneNumberCol}>
                  <Input
                    id="phone"
                    name="phone"
                    className={styles.phoneNumber}
                    size="bare"
                    inputClassName={styles.fieldInput}
                    type="tel"
                    autoComplete="tel"
                    required
                    maxLength={32}
                    value={phoneField}
                    onChange={(e) => {
                      setPhoneField(e.target.value)
                      handleFieldChange('phone', e.target.value)
                    }}
                  />
                  <span className={styles.fieldError}>Please enter a valid phone number.</span>
                </div>
              </div>
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`} {...fieldProps('address1')}>
              <label className={styles.fieldLabel} htmlFor="address1">
                Address
              </label>
              <Input
                id="address1"
                name="address1"
                size="bare"
                inputClassName={styles.fieldInput}
                type="text"
                autoComplete="address-line1"
                required
                maxLength={200}
                value={address1}
                onChange={(e) => {
                  setAddress1(e.target.value)
                  handleFieldChange('address1', e.target.value)
                }}
              />
              <span className={styles.fieldError}>Please enter your street address.</span>
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.fieldLabel} htmlFor="address2">
                Apartment, suite, etc. (optional)
              </label>
              <Input
                id="address2"
                name="address2"
                size="bare"
                inputClassName={styles.fieldInput}
                type="text"
                autoComplete="address-line2"
                maxLength={200}
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
              />
            </div>

            <div className={styles.field} {...fieldProps('city')}>
              <label className={styles.fieldLabel} htmlFor="city">
                City
              </label>
              <Input
                id="city"
                name="city"
                size="bare"
                inputClassName={styles.fieldInput}
                type="text"
                autoComplete="address-level2"
                required
                maxLength={120}
                value={city}
                onChange={(e) => {
                  setCity(e.target.value)
                  handleFieldChange('city', e.target.value)
                }}
              />
              <span className={styles.fieldError}>Please enter a city.</span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="state">
                State / region (optional)
              </label>
              <Input
                id="state"
                name="state"
                size="bare"
                inputClassName={styles.fieldInput}
                type="text"
                autoComplete="address-level1"
                maxLength={120}
                value={stateOrRegion}
                onChange={(e) => setStateOrRegion(e.target.value)}
              />
            </div>

            <div className={styles.field} {...fieldProps('postalCode')}>
              <label className={styles.fieldLabel} htmlFor="postalCode">
                Postal code
              </label>
              <Input
                id="postalCode"
                name="postalCode"
                size="bare"
                inputClassName={styles.fieldInput}
                type="text"
                autoComplete="postal-code"
                required
                maxLength={20}
                value={postalCode}
                onChange={(e) => {
                  setPostalCode(e.target.value)
                  handleFieldChange('postalCode', e.target.value)
                }}
              />
              <span className={styles.fieldError}>Please enter a valid postal code.</span>
            </div>
          </div>

          <div className={styles.editButtonRow}>
            <Button
              variant="secondary"
              size="bigSquared"
              label="Back to Configuration"
              iconLeft={<Icon name="arrowLeft" size={20} />}
              onClick={backToWizard}
            />
          </div>
        </form>

        <OrderSummary
          artwork={{
            title: artwork.title,
            artistName: artwork.artistName,
            year: artwork.year,
            imageUrl: artwork.imageUrl,
            originalWidthPx: artwork.originalWidthPx,
            originalHeightPx: artwork.originalHeightPx,
          }}
          specs={specs}
          orientation={orientation}
          country={country}
          priceLines={(() => {
            const artworkLine = quote?.lines.find((l) => l.id === 'artwork')
            const shippingLine = quote?.lines.find((l) => l.id === 'shipping')
            const placeholder = quoteLoading ? '…' : '—'
            const vatLabel = quote?.taxLabel ?? 'VAT'
            const vatValue =
              quote && quote.taxCents > 0 ? formatEuro(quote.taxCents) : country ? '—' : '—'
            return [
              {
                label: 'Artwork',
                value: artworkLine ? formatEuro(artworkLine.amountCents) : placeholder,
              },
              {
                label: 'Shipping',
                value: shippingLine ? formatEuro(shippingLine.amountCents) : '—',
                muted: true,
              },
              {
                label: vatLabel,
                value: vatValue,
                muted: true,
              },
            ]
          })()}
          total={{
            label: country ? 'Total' : 'Total (before taxes)',
            value: quote ? formatEuro(quote.totalCents) : '—',
          }}
          notes={[quoteError, submitError].filter((n): n is string => Boolean(n))}
          cta={{
            kind: 'button',
            label: submitting ? 'Preparing payment…' : 'Continue to payment',
            onClick: () => {
              void handleSubmit()
            },
            disabled: !canSubmit || submitting,
          }}
        />
      </main>
    </div>
  )
}

/**
 * Read the wizard → checkout handoff blob from sessionStorage. The
 * wizard hands off without a country (it's picked on this step), so
 * we only validate that the providerId still matches what the page
 * route resolved.
 */
function readHandoff(slug: string, providerId: ProviderId): WizardHandoff | null {
  try {
    const raw = sessionStorage.getItem(`print-quote:${slug}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WizardHandoff>
    if (!parsed.providerId || !parsed.config || !parsed.quote || !parsed.specs) {
      return null
    }
    if (parsed.providerId !== providerId) return null
    return parsed as WizardHandoff
  } catch {
    return null
  }
}
