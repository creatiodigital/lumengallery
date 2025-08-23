import type { WizardType } from '@/types/wizard'

export const wizardFactory = (): WizardType => ({
  isWizardOpen: false,
  isArtworkUploaded: false,
})
