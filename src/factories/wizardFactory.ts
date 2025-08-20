// factories/wizardFactory.ts
import type { Wizard } from '@/types/wizard'

export const wizardFactory = (): Wizard => ({
  isWizardOpen: false,
  isArtworkUploaded: false,
})
