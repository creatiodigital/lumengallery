import type { WizardConfig } from '@/lib/print-providers'

/**
 * Encode a wizard config into the URL search params the print wizard
 * re-hydrates from on mount (decoded by `readConfigFromParams` in index.tsx).
 *
 * Shared by every surface that sends the buyer back into the wizard with a
 * pre-filled selection — the checkout "back to wizard" action and the cart's
 * "Edit item" link — so the encode side stays in one place. Callers add
 * `provider` / `editLineId` themselves as needed.
 */
export function configToWizardParams(config: WizardConfig): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(config.values ?? {})) {
    params.set(key, value)
  }
  if (config.customSize) {
    params.set('customSize', `${config.customSize.widthCm}x${config.customSize.heightCm}`)
  }
  if (config.borders) {
    for (const [borderId, b] of Object.entries(config.borders)) {
      params.set(borderId, String(b.allCm))
    }
  }
  return params
}
