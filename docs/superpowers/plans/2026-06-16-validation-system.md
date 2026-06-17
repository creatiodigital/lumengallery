# Robust Form Validation System — Implementation Plan

> **For agentic workers:** execute task-by-task. After each task: `pnpm typecheck` + `pnpm lint` must be green; never commit until the user has tested. No unit-test framework exists in this repo — validation is verified by **Playwright e2e** (in `/e2e/`) + typecheck, NOT Vitest/Jest.

**Goal:** One coherent, DRY, secure validation system shared across every form — pure validators reused on client + server, a single field-error component, a form hook implementing the house flow, and **zero native browser validation/alerts**. Consolidate the three error idioms that exist today into one.

**Architecture:** Pure validators in `src/lib/validation/` (imported by both client forms and server actions). A `useFormValidation` hook owns the per-field error state + the flow (silent on arrival → all errors on submit → clear live as each field is fixed). A `FormField` wrapper renders `FormLabel` + the control + the single `ErrorText`. `Input`/`Textarea`/`SelectDropdown` gain an `invalid` prop for the error border (replacing the `!important` hack). Every `<form>` gets `noValidate`. Destructive actions use `ConfirmModal`, never `alert`/`confirm`.

**Tech stack:** Next.js App Router, React, TypeScript, SCSS modules. **No new dependencies.** Testing = Playwright e2e + typecheck.

**Hard constraints (don't break anything):** migrate form-by-form, typecheck after each; client-facing controls stay squared; no `!important`, no `var(--token, fallback)`; use `<Button>` / `ConfirmModal`, never native; keep server-side validation authoritative.

---

## Current state (from the audit)

- **Reference pattern:** `AddressForm` — custom `validateShippingField` + `errors` state + `submitAttempted` + `.fieldError` spans gated by `data-error`, implementing the documented flow. **It already has `noValidate`.** `PrintCheckout/index.tsx` is a near-verbatim copy (but is **missing `noValidate`** → native bubbles). `InquireSidebar` is a third clone.
- **Duplication:** `emailRegex` copied in 5 files; `validateShippingField` in 2; `validatePassword` (`src/utils/password.ts`) exists but client password forms re-check `< 8` inline.
- **Existing building blocks:** `ErrorText` (`src/components/ui/ErrorText`) is the de-facto error component but only used for one form-level string. `FormLabel` exists, underused. `Input` has `.error { border-color: … !important }` reachable via `variant="error"` (used once, ExhibitionModal). `size="bare"` Inputs skip ALL Input styles (checkout/wizard own the look via `inputClassName`) — so their error border must be applied at the field-wrapper level, not inside Input.
- **`noValidate`:** present on only 2 of ~18 forms.
- **Native dialogs:** `alert()` / `window.confirm()` in 6 files (AdminUsers, AdminExhibitions, dashboard/artworks, Payouts, wallview useFileUpload, useAddExistingArtwork). `ConfirmModal` already exists as the sanctioned replacement.
- **Gold-standard validator shape to mirror:** `src/lib/editions/validateVariant.ts` (`validateVariantInput`) — one pure function used by both the client editor and the server. This is the model.

---

## File structure

**New:**

- `src/lib/validation/index.ts` — shared validators + a `validateFields` runner.
- `src/hooks/useFormValidation.ts` — the form-state hook.
- `src/components/ui/FormField/FormField.tsx` + `FormField.module.scss` — label + control + error wrapper.

**Modified (shared layer):**

- `src/components/ui/Input/Input.tsx` + `Input.module.scss` — add `invalid` prop; delete the `!important` `.error`.
- `src/components/ui/Textarea/Textarea.tsx` (+ scss) — add `invalid` prop.
- `src/components/ui/SelectDropdown/SelectDropdown.tsx` (+ scss) — add `invalid` prop.

**Migrated (phased, listed in Phases 2–3).**

---

## Phase 1 — Build the shared layer (no behavior change to forms yet)

### Task 1: Shared validators — `src/lib/validation/index.ts`

- `export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` and `isEmail(v: string): boolean`.
- Field validators, each `(value: string) => string | undefined`:
  `required(label)`, `email()`, `phone()` (digits ≥ 8 and not all-identical — copied from AddressForm), `postalCode()`, `minLength(n, label)`, `name()`.
- `type Validator = (value: string) => string | undefined`.
- `validateFields<K extends string>(values: Record<K,string>, schema: Partial<Record<K, Validator>>): Partial<Record<K,string>>`.
- Move `validateShippingField` + its field set here as `shippingValidators`. Re-export `validatePassword` from `src/utils/password.ts` so client + server import validation from one place.
- **Verify:** `pnpm typecheck`. Then replace the 5 `emailRegex` copies + 2 `validateShippingField` copies with imports (mechanical), typecheck again.

### Task 2: Hook — `src/hooks/useFormValidation.ts`

- `useFormValidation<K>(schema)` → `{ errors, submitAttempted, validateAll(values) => boolean, handleChange(name, value), fieldError(name) }`.
- Behavior (lifted verbatim from AddressForm): errors empty until first submit; `validateAll` sets all errors and returns validity; after `submitAttempted`, `handleChange` re-validates only already-errored fields so they clear live.
- **Verify:** typecheck.

### Task 3: `FormField` — `src/components/ui/FormField/`

- Props: `{ label?: string; htmlFor?: string; required?: boolean; error?: string; className?: string; children: ReactNode }`.
- Renders: `<div className={styles.field} data-error={error ? 'true' : 'false'}>` → `<FormLabel htmlFor required>` + `{children}` + `{error && <ErrorText>{error}</ErrorText>}`.
- SCSS: `.field { display:flex; flex-direction:column; gap: var(--space-1) }`; `.field[data-error='true'] :where(input, textarea) { border-color: var(--color-error-text) }` (covers bare inputs without an `invalid` prop). No `!important`.
- **Verify:** typecheck.

### Task 4: `invalid` prop on controls + kill the `!important`

- `Input.tsx`: add `invalid?: boolean`; when true add `styles.invalid` (non-bare) and always set `aria-invalid={invalid || undefined}`.
- `Input.module.scss`: replace `.error { border-color: var(--color-error-text) !important }` with `.invalid { border-color: var(--color-error-text) }` (no `!important`). Update the one `variant="error"` consumer (ExhibitionModal) to `invalid`.
- `Textarea.tsx` + `SelectDropdown.tsx`: same `invalid` prop + error-border class (squared, token color).
- **Verify:** typecheck; confirm ExhibitionModal still shows its invalid border.

---

## Phase 2 — Migrate the buyer-facing flow (the AR-129 surfaces)

### Task 5: `AddressForm` → hook + `FormField` + shared validators

- Replace local `validateShippingField`/`emailRegex` with imports; replace the per-field `.field … <span .fieldError>` blocks with `<FormField label … error={fieldError('email')}>`. Keep `noValidate`. The message now comes from the validator (no hardcoded inline strings).
- **Verify:** typecheck + manual: native bubble gone, custom errors on submit, clear-live on fix.

### Task 6: `PrintCheckout/index.tsx` address → same; **ADD `noValidate`** (currently missing — the highest-leverage native-bubble fix). Remove its duplicated validators.

### Task 7: `InquireSidebar` → hook + `FormField` + shared validators (keep the honeypot). Add `noValidate`.

### Task 8: Server mirror — point the server validators at the shared module

- `src/lib/checkout/sanitizeAndValidateAddress.ts` and `/api/inquire` import the same `email`/`phone`/`required` validators so client and server never drift. (Address re-pricing/tamper checks stay.)
- **Verify:** typecheck.

---

## Phase 3 — Site-wide consolidation

### Task 9: Auth forms — login, `reset-password`, `ChangePasswordPage`, `ForgotPasswordModal`, `AddArtistModal`

- `FormField` + shared validators; import `validatePassword` instead of inline `< 8`; add `noValidate` everywhere.

### Task 10: Dashboard/admin forms — `dashboard/profile`, exhibition settings, `ExhibitionModal` (→ `invalid` prop, drop `variant="error"`), `AddArtworkModal`, `ArtworkEditForm` + `LimitedVariantsEditor`, `SavePresetModal`

- `FormField` + `noValidate`; keep the live async URL-check forms live (justified exception) but route their messages through `ErrorText`.

### Task 11: Print wizard — keep the clamp-on-input behavior, but surface any blocking messages via `ErrorText` (no native, no silent-only where an error is warranted).

### Task 12: Replace native dialogs with `ConfirmModal` — AdminUsers, AdminExhibitions, dashboard/artworks (delete/remove), Payouts (disconnect), wallview `useFileUpload` (file-too-large → inline `ErrorText`), `useAddExistingArtwork` (duplicate → inline). Failure toasts become inline `ErrorText`.

---

## Phase 4 — Enforcement & tests

### Task 13 (optional): a shared `<Form>` wrapper that sets `noValidate` by default, or an ESLint rule, so new forms can't regress to native validation.

### Task 14: Playwright e2e (write only; user runs) covering: required-field errors appear on submit; invalid email rejected; invalid phone rejected; error clears live once fixed; **no native browser bubble appears**; ConfirmModal gates a destructive delete.

---

## Self-review

- **Covers the asks:** required ✓, valid email ✓, phone format ✓; "secure all fields" → server mirror (Task 8) ✓; "consolidate the error messages everywhere" → `FormField` + single `ErrorText`, messages sourced from validators (Tasks 3–7) ✓; "no native warnings ever" → `noValidate` everywhere + `ConfirmModal` (Tasks 6–12) ✓; "efficient, no repeated inline messages" → validators own the strings ✓.
- **House rules:** no new deps; `!important` removed (Task 4); squared controls preserved; `<Button>`/`ConfirmModal` only; Playwright-only testing.
- **Won't break things:** Phase 1 is additive (no form changes); Phases 2–3 migrate one form per task with typecheck/lint between; server validation stays authoritative throughout.
- **Phasing:** the buyer flow (Phase 2) can ship on its own; Phase 3 (auth/admin/dashboard/wizard + alert cleanup) can be a follow-up PR if we want to keep this one scoped.
