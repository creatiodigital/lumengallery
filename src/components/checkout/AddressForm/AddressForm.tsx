'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { SelectDropdown, type SelectOption } from '@/components/ui/SelectDropdown'
import { COUNTRY_NAMES, DIAL_CODES, getCountryName } from '@/lib/print-providers/dialCodes'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

import styles from './AddressForm.module.scss'

// Country names come from a static map (COUNTRY_NAMES in dialCodes.ts)
// rather than Intl.DisplayNames. Reason: Node and Chrome ship different
// ICU data for politically-sensitive regions (e.g. FK), so the SSR option
// text disagrees with the CSR option text and React throws a hydration
// mismatch. Static map => identical strings on both sides.
const sortCountries = (codes: string[]) =>
  [...codes].sort((a, b) => getCountryName(a).localeCompare(getCountryName(b)))

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

// Same rules as the single-print checkout (PrintCheckout/index.tsx) so the
// two surfaces validate identically. Kept here as a fresh copy: this form
// is fully self-contained and presentational, and the single-print path's
// form is tangled with its own sessionStorage/handoff effects, so sharing
// risked breaking it — see the task report.
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

type AddressFormProps = {
  /** Called with the assembled, trimmed ShippingAddress once every field
   *  passes validation. The parent (CartCheckout) owns the server call. */
  onSubmit: (address: ShippingAddress) => void
  /** Disables the submit control while the parent is validating/pricing. */
  submitting?: boolean
  /** Label for the primary submit button. */
  submitLabel?: string
  /** Pre-fill country (e.g. a remembered choice). Defaults to empty so the
   *  buyer makes an explicit destination decision. */
  initialCountry?: string
  /** Country codes to offer in the picker. Defaults to every known country
   *  (per-line shippability is enforced server-side by validateCart). */
  countryCodes?: string[]
}

/**
 * Reusable, presentational address + buyer-info form. Owns its own field
 * state + validation UX (silent on arrival → all errors on submit → clear
 * live as each field is fixed) and emits a single ShippingAddress on a
 * valid submit. No pricing, no cart, no persistence — those are the
 * caller's concern.
 */
export const AddressForm = ({
  onSubmit,
  submitting = false,
  submitLabel = 'Continue',
  initialCountry = '',
  countryCodes,
}: AddressFormProps) => {
  const [country, setCountry] = useState(initialCountry)
  const [fullName, setFullName] = useState('')
  const [emailField, setEmailField] = useState('')
  const [phoneField, setPhoneField] = useState('')
  const [address1, setAddress1] = useState('')
  const [address2, setAddress2] = useState('')
  const [city, setCity] = useState('')
  const [stateOrRegion, setStateOrRegion] = useState('')
  const [postalCode, setPostalCode] = useState('')
  // Independent of `country` by design — a buyer might keep a foreign phone
  // after relocating or be sending a gift to another country. We seed it
  // from the initial shipping country (best guess) but never auto-sync
  // after that; the buyer owns the choice.
  const [phoneDial, setPhoneDial] = useState(() => DIAL_CODES[initialCountry] ?? DIAL_CODES.ES)

  // Validation errors keyed by field name. Populated only after the first
  // submit attempt; cleared/updated as the buyer fixes each field.
  const [errors, setErrors] = useState<ShippingErrors>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const countryOptions: SelectOption<string>[] = useMemo(() => {
    const codes = countryCodes ?? Object.keys(COUNTRY_NAMES)
    return sortCountries(codes).map((code) => ({
      value: code,
      label: getCountryName(code),
    }))
  }, [countryCodes])

  // Phone-prefix options: unique dial codes only (many countries share a
  // prefix — e.g. +1 covers US/CA/Caribbean — and the digits a buyer types
  // work the same regardless), sorted numerically. Independent of the
  // shipping country: the buyer's phone can be from anywhere.
  const phoneDialOptions: SelectOption<string>[] = useMemo(() => {
    const unique = Array.from(new Set(Object.values(DIAL_CODES)))
    return unique
      .sort((a, b) => Number(a) - Number(b))
      .map((dial) => ({ value: dial, label: `+${dial}` }))
  }, [])

  // Re-validate one field as the buyer edits it after the first failed
  // submit so the error message clears in place once they fix it.
  const handleFieldChange = (name: ShippingFieldName, value: string) => {
    if (!submitAttempted) return
    if (!(name in errors)) return
    setErrors((prev) => ({ ...prev, [name]: validateShippingField(name, value) }))
  }

  const fieldProps = (name: ShippingFieldName) => ({
    'data-error': errors[name] ? 'true' : 'false',
  })

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
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

    // Combine the dial-code dropdown choice with the digits the buyer typed.
    // Parent gets a single E.164-ish string ("+34 612345678") it can pass
    // straight to TPS / show in admin orders.
    const rawPhone = phoneField.trim()
    const phoneCombined = rawPhone && phoneDial ? `+${phoneDial} ${rawPhone}` : rawPhone

    onSubmit({
      fullName: fullName.trim(),
      email: emailField.trim(),
      phone: phoneCombined,
      countryCode: country,
      address1: address1.trim(),
      address2: address2.trim(),
      city: city.trim(),
      stateOrRegion: stateOrRegion.trim(),
      postalCode: postalCode.trim(),
    })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
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

      <div className={styles.submitRow}>
        <Button
          type="submit"
          variant="primary"
          size="bigSquared"
          fullWidth
          disabled={submitting}
          label={submitting ? 'Checking availability…' : submitLabel}
          iconRight={<Icon name="arrowRight" size={20} />}
        />
      </div>
    </form>
  )
}
