import c from 'classnames'
import type { ReactNode } from 'react'

import { ErrorText } from '@/components/ui/ErrorText'
import { FormLabel } from '@/components/ui/FormLabel'

import styles from './FormField.module.scss'

type FormFieldProps = {
  /** Optional label rendered above the control. */
  label?: string
  /** `id` of the control this label points at (click-to-focus + a11y). */
  htmlFor?: string
  /** Show the required asterisk on the label. */
  required?: boolean
  /** Current error message, or undefined when valid. When set, the control
   *  gets a red border and the message renders below it. */
  error?: string
  className?: string
  children: ReactNode
}

/**
 * One form field: label + control + a single error message. Applies the red
 * error border to the control when `error` is set (covers "bare" inputs that
 * own their own styling via the wrapper's `data-error`). The house wrapper for
 * every form field — pair it with `useFormValidation`:
 * `<FormField label="Email" htmlFor="email" error={fieldError('email')}>`.
 * Squared controls + token colors; no `!important`.
 */
export const FormField = ({
  label,
  htmlFor,
  required,
  error,
  className,
  children,
}: FormFieldProps) => {
  return (
    <div className={c(styles.field, className)} data-error={error ? 'true' : 'false'}>
      {label && (
        <FormLabel htmlFor={htmlFor} required={required}>
          {label}
        </FormLabel>
      )}
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}

export default FormField
