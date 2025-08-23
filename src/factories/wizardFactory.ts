import type { TWizard } from '@/types/wizard'

export const wizardFactory = (): TWizard => ({
  isWizardOpen: false,
  isArtworkUploaded: false,
})
