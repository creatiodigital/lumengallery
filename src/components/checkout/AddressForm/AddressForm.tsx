'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { SelectDropdown, type SelectOption } from '@/components/ui/SelectDropdown'
import { useFormValidation } from '@/hooks/useFormValidation'
import { COUNTRY_NAMES, DIAL_CODES, getCountryName } from '@/lib/print-providers/dialCodes'
import { shippingValidators, type ShippingFieldName } from '@/lib/validation'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

import styles from './AddressForm.module.scss'

// Country names come from a static map (COUNTRY_NAMES in dialCodes.ts)
// rather than Intl.DisplayNames. Reason: Node and Chrome ship different
// ICU data for politically-sensitive regions (e.g. FK), so the SSR option
// text disagrees with the CSR option text and React throws a hydration
// mismatch. Static map => identical strings on both sides.
const sortCountries = (codes: string[]) =>
  [...codes].sort((a, b) => getCountryName(a).localeCompare(getCountryName(b)))

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
 * state and delegates validation to the shared `useFormValidation` hook +
 * `shippingValidators` (silent on arrival → all errors on submit → clear
 * live as each field is fixed). Emits a single ShippingAddress on a valid
 * submit. No pricing, no cart, no persistence — those are the caller's
 * concern.
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

  // Per-field error state + the house validation flow, shared across every
  // checkout surface via the same `shippingValidators`.
  const { validateAll, handleChange, fieldError } = useFormValidation(shippingValidators)

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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()

    const fieldValues: Record<ShippingFieldName, string> = {
      country,
      fullName,
      email: emailField,
      phone: phoneField,
      address1,
      city,
      postalCode,
    }
    if (!validateAll(fieldValues)) return

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

      <FormField className={styles.fieldFull} error={fieldError('country')}>
        <label className={styles.fieldLabel} htmlFor="country">
          Country
        </label>
        <SelectDropdown<string>
          options={countryOptions}
          value={country}
          onChange={(next) => {
            setCountry(next)
            handleChange('country', next)
          }}
          placeholder="Choose a country…"
          invalid={!!fieldError('country')}
        />
      </FormField>

      <div className={styles.fieldGrid}>
        <FormField className={styles.fieldFull} error={fieldError('fullName')}>
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
            invalid={!!fieldError('fullName')}
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value)
              handleChange('fullName', e.target.value)
            }}
          />
        </FormField>

        <FormField error={fieldError('email')}>
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
            invalid={!!fieldError('email')}
            value={emailField}
            onChange={(e) => {
              setEmailField(e.target.value)
              handleChange('email', e.target.value)
            }}
          />
        </FormField>

        <FormField error={fieldError('phone')}>
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
                invalid={!!fieldError('phone')}
                value={phoneField}
                onChange={(e) => {
                  setPhoneField(e.target.value)
                  handleChange('phone', e.target.value)
                }}
              />
            </div>
          </div>
        </FormField>

        <FormField className={styles.fieldFull} error={fieldError('address1')}>
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
            invalid={!!fieldError('address1')}
            value={address1}
            onChange={(e) => {
              setAddress1(e.target.value)
              handleChange('address1', e.target.value)
            }}
          />
        </FormField>

        <FormField className={styles.fieldFull}>
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
        </FormField>

        <FormField error={fieldError('city')}>
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
            invalid={!!fieldError('city')}
            value={city}
            onChange={(e) => {
              setCity(e.target.value)
              handleChange('city', e.target.value)
            }}
          />
        </FormField>

        <FormField>
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
        </FormField>

        <FormField error={fieldError('postalCode')}>
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
            invalid={!!fieldError('postalCode')}
            value={postalCode}
            onChange={(e) => {
              setPostalCode(e.target.value)
              handleChange('postalCode', e.target.value)
            }}
          />
        </FormField>
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
