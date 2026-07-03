/**
 * Shared, pure form validators — imported by BOTH client forms and server
 * actions / route handlers so the two can never drift. Modeled on
 * src/lib/editions/validateVariant.ts (one pure function reused on client +
 * server). Validation is verified by Playwright e2e + typecheck; there is no
 * unit-test framework in this repo.
 *
 * Each field validator has the shape `(value: string) => string | undefined`:
 * it returns the user-facing error message, or `undefined` when the value is
 * acceptable. The message strings live here so no form hardcodes its own
 * copy — `FormField` renders whatever the validator returns.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** True when `value` (trimmed) looks like an email address. */
export const isEmail = (value: string): boolean => EMAIL_REGEX.test(value.trim())

/**
 * A field validator: maps a raw input value to an error message, or
 * `undefined` when the value passes.
 */
export type Validator = (value: string) => string | undefined

// ── Field-validator factories ──────────────────────────────────────────────
// Each returns a Validator. The optional `message` overrides the default so a
// form can keep an exact, field-specific string while the logic stays shared.

/** Requires a non-blank value (after trimming). */
export const required =
  (message = 'This field is required.'): Validator =>
  (value) =>
    value.trim() ? undefined : message

/** Requires at least `n` characters (after trimming). */
export const minLength =
  (n: number, message: string): Validator =>
  (value) =>
    value.trim().length >= n ? undefined : message

/** A full name: at least 2 non-blank characters. */
export const name = (message = 'Please enter your full name.'): Validator => minLength(2, message)

/** A valid email address. */
export const email =
  (message = 'Please enter a valid email address.'): Validator =>
  (value) =>
    isEmail(value) ? undefined : message

/**
 * A usable phone number from a single free-text field (the buyer types the
 * whole number, optionally with their own "+<country code>"). Lenient on
 * formatting but rejects junk:
 *   - a trailing extension ("x12", "ext. 12", "extension 12") is accepted and
 *     ignored for the digit count;
 *   - only phone-shaped characters: an optional leading "+", then digits and
 *     common separators (space, dash, dot, slash, parens — "030/12345678" is
 *     standard German notation) — letters or a value pasted from the wrong
 *     field are rejected;
 *   - 8–15 significant digits (E.164 cap); an international "00" dial prefix
 *     doesn't count against the 15;
 *   - not all the same digit (e.g. "00000000").
 */
export const phone =
  (message = 'Please enter a valid phone number.'): Validator =>
  (value) => {
    const trimmed = value.trim()
    // Split off a trailing extension before validating the dialable part.
    const main = trimmed.replace(/\s*(?:ext(?:ension)?\.?|x)\s*\d{1,6}$/i, '')
    if (!/^\+?[\d\s()./-]+$/.test(main)) return message
    let digits = main.replace(/\D/g, '')
    if (digits.startsWith('00')) digits = digits.slice(2) // international prefix
    if (digits.length < 8 || digits.length > 15) return message
    if (/^(\d)\1+$/.test(digits)) return message
    return undefined
  }

/** A postal code: at least 3 characters and containing at least one digit. */
export const postalCode =
  (message = 'Please enter a valid postal code.'): Validator =>
  (value) => {
    const trimmed = value.trim()
    if (trimmed.length < 3 || !/\d/.test(trimmed)) return message
    return undefined
  }

/**
 * Run a set of validators over a values object and collect the failures.
 * Only keys present in `schema` are checked; missing values are treated as ''.
 */
export const validateFields = <K extends string>(
  values: Record<K, string>,
  schema: Partial<Record<K, Validator>>,
): Partial<Record<K, string>> => {
  const errors: Partial<Record<K, string>> = {}
  for (const key of Object.keys(schema) as K[]) {
    const validator = schema[key]
    if (!validator) continue
    const error = validator(values[key] ?? '')
    if (error) errors[key] = error
  }
  return errors
}

// ── Shipping address ────────────────────────────────────────────────────────
// The buyer's shipping + contact fields, validated identically on the cart
// checkout (AddressForm) and the single-print checkout (PrintCheckout), and
// mirrored server-side by sanitizeAndValidateAddress so client and server
// never disagree.

export type ShippingFieldName =
  | 'country'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'address1'
  | 'city'
  | 'postalCode'

export const shippingValidators: Record<ShippingFieldName, Validator> = {
  country: required('Please choose a country.'),
  fullName: name(),
  email: email(),
  phone: phone(),
  address1: minLength(3, 'Please enter your street address.'),
  city: minLength(2, 'Please enter a city.'),
  postalCode: postalCode(),
}

/**
 * Validate one shipping field by name. Thin wrapper over `shippingValidators`
 * so existing call sites (`validateShippingField(name, value)`) keep working.
 */
export const validateShippingField = (
  fieldName: ShippingFieldName,
  value: string,
): string | undefined => shippingValidators[fieldName](value)

// Re-export password validation so client forms and server routes import all
// validation from one place (the rules themselves live in utils/password.ts).
export { validatePassword } from '@/utils/password'
export type { PasswordValidationResult } from '@/utils/password'
