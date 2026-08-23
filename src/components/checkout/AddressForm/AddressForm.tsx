'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { SelectDropdown, type SelectOption } from '@/components/ui/SelectDropdown'
import { useFormValidation } from '@/hooks/useFormValidation'
import { COUNTRY_NAMES, getCountryName } from '@/lib/print-providers/dialCodes'
import { shippingValidators, type ShippingFieldName } from '@/lib/validation'
import type { LookupFailure } from '@/lib/checkout/addressLookup'
import type { MappedAddress } from '@/lib/checkout/placeToAddress'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

import { AddressAutocomplete } from './AddressAutocomplete'
import { ShippingCountriesModal } from './ShippingCountriesModal'

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
  /** Pre-fill every field — used when the buyer returns via "Change address"
   *  so their entries aren't lost on the form's remount. */
  initialAddress?: ShippingAddress | null
  /** Whether address suggestions are available at all. Resolved on the SERVER
   *  from the presence of a Maps key, because the key never reaches the browser
   *  — see /api/checkout/address-lookup. Off means the plain manual form, which
   *  is exactly what shipped before this feature. */
  addressAutocomplete?: boolean
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
  initialAddress = null,
  addressAutocomplete = false,
}: AddressFormProps) => {
  // Seed from a previously-submitted address when present (the buyer came back
  // via "Change address"); the form remounts each time it's shown, so these
  // lazy initializers re-read the latest values on every return.
  const [country, setCountry] = useState(initialAddress?.countryCode || initialCountry)
  const [fullName, setFullName] = useState(initialAddress?.fullName ?? '')
  const [emailField, setEmailField] = useState(initialAddress?.email ?? '')
  // Single free-text phone field (Amazon-style): the buyer types the whole
  // number, including their own "+<code>" if it's a foreign phone. We capture
  // the country separately above, so no dial-code dropdown is needed — and with
  // one input there's no second place a country code can live, which is what
  // used to produce "+34 +34…".
  const [phoneField, setPhoneField] = useState(initialAddress?.phone ?? '')
  const [address1, setAddress1] = useState(initialAddress?.address1 ?? '')
  const [address2, setAddress2] = useState(initialAddress?.address2 ?? '')
  const [city, setCity] = useState(initialAddress?.city ?? '')
  const [stateOrRegion, setStateOrRegion] = useState(initialAddress?.stateOrRegion ?? '')
  const [postalCode, setPostalCode] = useState(initialAddress?.postalCode ?? '')

  // Per-field error state + the house validation flow, shared across every
  // checkout surface via the same `shippingValidators`.
  const { validateAll, handleChange, fieldError } = useFormValidation(shippingValidators)

  // Set once the buyer chooses "Enter address manually", or once a lookup
  // fails. One-way on purpose: someone who has opted out of the suggestions is
  // mid-typing, and yanking the dropdown back would fight them.
  const [manualEntry, setManualEntry] = useState(false)
  const [countriesOpen, setCountriesOpen] = useState(false)
  // Why suggestions stopped, when they stopped on their own rather than by
  // choice. Drives one quiet line under the field.
  const [lookupFailure, setLookupFailure] = useState<LookupFailure | null>(null)

  // A returning buyer already has a full address on the form; re-offering
  // suggestions over it would invite them to redo work they have done.
  useEffect(() => {
    if (initialAddress?.address1) setManualEntry(true)
  }, [initialAddress])

  /**
   * True while OUR suggestions own the address block.
   *
   * When they do, Chrome's autofill has to be kept off every address field —
   * not just the street line. Suppressing it on the street alone leaves the
   * worst of both: Chrome fills city, region and postcode from a saved profile
   * while the street stays blank, and the buyer is handed a half-filled address
   * with no obvious way to finish it.
   *
   * Identity fields (name, email, phone) keep their normal tokens throughout.
   * Nothing of ours competes there, and they are exactly what a returning buyer
   * wants filled for them.
   */
  const suggestionsOwnAddress = addressAutocomplete && !manualEntry

  /**
   * Chrome only autofills fields whose autocomplete token it recognises, so a
   * semantic-but-unlisted token is what actually suppresses it —
   * `autocomplete="off"` has been ignored for autofill since 2014.
   */
  const addressToken = (standard: string) =>
    suggestionsOwnAddress ? `${standard}-search` : standard

  /**
   * Changing the country empties the address.
   *
   * An address only means something inside one country: "Calle de Serrano 21,
   * Madrid, 28001" under United States is not a partial address, it is a wrong
   * one — and it would go to the carrier exactly as it stands. Keeping it to
   * save typing trades a few seconds against a parcel that cannot be delivered.
   *
   * Identity survives: name, email and phone belong to the buyer, not to the
   * destination. Only the address block is cleared.
   *
   * Skipped on the first render so a returning buyer's restored address is not
   * wiped by the country being set from it.
   */
  const previousCountry = useRef<string | null>(null)
  useEffect(() => {
    if (previousCountry.current === null) {
      previousCountry.current = country
      return
    }
    if (previousCountry.current === country) return
    previousCountry.current = country

    setAddress1('')
    setAddress2('')
    setCity('')
    setStateOrRegion('')
    setPostalCode('')
    // Errors belonged to the cleared values; leaving them would mark empty
    // fields invalid before the buyer has typed anything (see the house rule:
    // silent on arrival, errors on submit).
    handleChange('address1', '')
    handleChange('city', '')
    handleChange('postalCode', '')

    // A fresh country is a fresh start, so offer suggestions again — unless
    // they stopped working, in which case re-offering a broken control is worse
    // than the manual form the buyer already has.
    if (!lookupFailure) setManualEntry(false)
  }, [country, handleChange, lookupFailure])

  /** Fill every field a chosen suggestion knows about. */
  const applyPlace = (place: MappedAddress) => {
    setAddress1(place.address1)
    handleChange('address1', place.address1)
    // Only overwrite the apartment line when Google actually has one — the
    // buyer may have typed "Apt 4B" already, and a suggestion that knows
    // nothing about it must not wipe it.
    if (place.address2) setAddress2(place.address2)
    setCity(place.city)
    handleChange('city', place.city)
    setStateOrRegion(place.stateOrRegion)
    setPostalCode(place.postalCode)
    handleChange('postalCode', place.postalCode)
    // The country picker drove the search, so a differing code means Google
    // disagrees with the buyer's own choice. Trust Google — it read the address.
    if (place.countryCode && place.countryCode !== country) {
      setCountry(place.countryCode)
      handleChange('country', place.countryCode)
    }
  }

  const countryOptions: SelectOption<string>[] = useMemo(() => {
    const codes = countryCodes ?? Object.keys(COUNTRY_NAMES)
    return sortCountries(codes).map((code) => ({
      value: code,
      label: getCountryName(code),
    }))
  }, [countryCodes])

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

    onSubmit({
      fullName: fullName.trim(),
      email: emailField.trim(),
      phone: phoneField.trim(),
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
        <div className={styles.labelRow}>
          <label className={styles.fieldLabel} htmlFor="country">
            Country
          </label>
          {/* A buyer who can't find their country has one question — "do you
              ship to me?" — and the worst answer is making them abandon a
              half-filled checkout to go and look. This opens over the flow. */}
          <Button
            type="button"
            variant="bare"
            className={styles.whereWeShip}
            onClick={() => setCountriesOpen(true)}
            label="Where we ship"
          />
        </div>
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
          <Input
            id="phone"
            name="phone"
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
        </FormField>

        <FormField className={styles.fieldFull} error={fieldError('address1')}>
          <label className={styles.fieldLabel} htmlFor="address1">
            Address
          </label>
          {suggestionsOwnAddress ? (
            <AddressAutocomplete
              inputId="address1"
              value={address1}
              countryCode={country}
              invalid={!!fieldError('address1')}
              onChange={(next) => {
                setAddress1(next)
                handleChange('address1', next)
              }}
              onPlaceSelected={applyPlace}
              // Whatever has been typed stays in address1 — the point of the
              // escape hatch is that nobody retypes a long address.
              onUnavailable={(reason) => {
                setLookupFailure(reason)
                setManualEntry(true)
              }}
            />
          ) : (
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
          )}
          {suggestionsOwnAddress && (
            <Button
              type="button"
              variant="bare"
              className={styles.manualEntryLink}
              onClick={() => setManualEntry(true)}
              label="Enter address manually"
            />
          )}
          {lookupFailure && (
            <span className={styles.lookupNotice}>
              {lookupFailure === 'rate_limited'
                ? 'Address suggestions are busy right now — please type your address below. Everything else works normally.'
                : 'Address suggestions aren’t available right now — please type your address below. Everything else works normally.'}
            </span>
          )}
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
            autoComplete={addressToken('address-line2')}
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
            autoComplete={addressToken('address-level2')}
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
            autoComplete={addressToken('address-level1')}
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
            autoComplete={addressToken('postal-code')}
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

      {/* Placed at the point of commitment rather than at the top of the form,
          where it would be read before there is anything to check. We print
          this address onto the carrier label exactly as it stands. */}
      <p className={styles.addressCheckNotice}>
        <Icon name="alert-circle" size={16} />
        <span>
          <strong>Please double-check your address.</strong> We print it on the parcel label exactly
          as entered. A delivery that fails because of an incorrect or incomplete address can’t be
          refunded or reshipped at our cost.
        </span>
      </p>

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

      {countriesOpen && (
        <ShippingCountriesModal
          countryCodes={countryCodes ?? Object.keys(COUNTRY_NAMES)}
          onClose={() => setCountriesOpen(false)}
          onSelect={(code) => {
            setCountry(code)
            handleChange('country', code)
            setCountriesOpen(false)
          }}
        />
      )}
    </form>
  )
}
