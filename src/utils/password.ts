/**
 * Password validation and generation utilities
 */

// Password requirements: 8+ chars, at least 1 uppercase, 1 lowercase, 1 number
const PASSWORD_MIN_LENGTH = 8
// Not a policy limit — bcrypt only reads the first 72 bytes anyway. This exists
// so an unbounded string can never reach hashing or a database write. Kept in
// step with MAX_LENGTHS.password in src/lib/validation.
const PASSWORD_MAX_LENGTH = 200
const PASSWORD_RULES = [
  { regex: /[A-Z]/, message: 'at least one uppercase letter' },
  { regex: /[a-z]/, message: 'at least one lowercase letter' },
  { regex: /[0-9]/, message: 'at least one number' },
]

export type PasswordValidationResult = {
  valid: boolean
  errors: string[]
}

/**
 * Validate a password against the requirements.
 * Returns { valid: true } or { valid: false, errors: [...] }
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`at least ${PASSWORD_MIN_LENGTH} characters`)
  }

  // Returns early: the rules below run regexes over the whole string, and there
  // is no reason to spend that on input already being rejected.
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, errors: [`at most ${PASSWORD_MAX_LENGTH} characters`] }
  }

  for (const rule of PASSWORD_RULES) {
    if (!rule.regex.test(password)) {
      errors.push(rule.message)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Generate a random provisional password that meets all requirements.
 * Format: 2 uppercase + 2 lowercase + 2 digits + 2 lowercase = 8 chars, then shuffled
 */
export function generateProvisionalPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // No I, O to avoid confusion
  const lower = 'abcdefghjkmnpqrstuvwxyz' // No i, l, o to avoid confusion
  const digits = '23456789' // No 0, 1 to avoid confusion

  const pick = (chars: string, count: number) =>
    Array.from({ length: count }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

  const parts = pick(upper, 2) + pick(lower, 4) + pick(digits, 2)

  // Shuffle
  return parts
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}
