'use client'

import { useCallback, useState } from 'react'

import { validateFields, type Validator } from '@/lib/validation'

export type FieldErrors<K extends string> = Partial<Record<K, string>>

export type UseFormValidation<K extends string> = {
  /** Per-field error messages. Empty until the first submit attempt. */
  errors: FieldErrors<K>
  /** True once the user has tried to submit at least once. */
  submitAttempted: boolean
  /**
   * Validate every field in the schema against `values`. Records all errors
   * and returns `true` when the form is valid. Call from the form's onSubmit.
   */
  validateAll: (values: Record<K, string>) => boolean
  /**
   * Re-validate a single field as the user edits it — but only after a failed
   * submit, and only for fields that are already showing an error, so the
   * message clears in place once fixed (no live red while first typing a
   * field). This is the house validation flow.
   */
  handleChange: (fieldName: K, value: string) => void
  /** The current error message for a field, if any. */
  fieldError: (fieldName: K) => string | undefined
  /** Clear all errors and reset the submit flag (e.g. after a successful send). */
  reset: () => void
}

/**
 * Owns a form's per-field error state and the house validation UX: silent on
 * arrival → all errors shown on submit → each error clears live as the user
 * fixes that field. Lifted verbatim from the AddressForm reference so every
 * form behaves identically.
 *
 * Pass a STABLE `schema` (a module-level `Record<field, Validator>` such as
 * `shippingValidators`, or one wrapped in `useMemo`) so the returned handlers
 * keep a stable identity across renders.
 */
export function useFormValidation<K extends string>(
  schema: Partial<Record<K, Validator>>,
): UseFormValidation<K> {
  const [errors, setErrors] = useState<FieldErrors<K>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const validateAll = useCallback(
    (values: Record<K, string>) => {
      setSubmitAttempted(true)
      const nextErrors = validateFields(values, schema)
      setErrors(nextErrors)
      return Object.keys(nextErrors).length === 0
    },
    [schema],
  )

  const handleChange = useCallback(
    (fieldName: K, value: string) => {
      if (!submitAttempted) return
      setErrors((prev) => {
        // Only fields that already failed get live re-validation; a field that
        // passed at submit stays silent until the next submit.
        if (!(fieldName in prev)) return prev
        const validator = schema[fieldName]
        return { ...prev, [fieldName]: validator ? validator(value) : undefined }
      })
    },
    [submitAttempted, schema],
  )

  const fieldError = useCallback((fieldName: K) => errors[fieldName], [errors])

  const reset = useCallback(() => {
    setErrors({})
    setSubmitAttempted(false)
  }, [])

  return { errors, submitAttempted, validateAll, handleChange, fieldError, reset }
}
