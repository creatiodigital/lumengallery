import { test, expect } from '@playwright/test'

import { TPS_PAPERS } from '@/lib/print-providers/printspace/data'

import { restoreArtworkPrintOptions, setArtworkPrintOptions } from './cleanup-helpers'
import { fixtures } from './fixtures'
import { openWizard, pickWizardOption, readWizardOptions } from './wizard-helpers'

/**
 * Per-artwork print-restriction contract — DB ↔ wizard.
 *
 * Artist veto state lives in `Artwork.printOptions` as the canonical
 * `PrintRestrictions` shape — `{ allowed: { paper: [...] } }`. The
 * spec seeds a known restriction on the fixture artwork (allowing all
 * but one paper), opens the public wizard as a buyer, asserts the
 * vetoed paper is absent from every print-type branch, and restores
 * the original `printOptions` in `finally` — so the suite stays
 * deterministic regardless of whether any real artist has configured
 * restrictions in the dev DB.
 *
 * Sizes are intentionally not asserted: TPS exposes a continuous size
 * slider rather than preset checkboxes, so there is no veto surface
 * to test. Paper veto is the relevant contract here.
 */

test.skip('TPS: wizard hides papers the artist vetoed in the DB', async ({ page }) => {
  test.setTimeout(60_000)

  const slug = fixtures.artworkSlug
  // Veto the last catalog paper — any single paper works; this just
  // gives the assertion a deterministic target across runs.
  const vetoedPaper = TPS_PAPERS[TPS_PAPERS.length - 1]
  const seededAllowedPapers = TPS_PAPERS.filter((p) => p.id !== vetoedPaper.id).map((p) => p.id)

  const previousPrintOptions = await setArtworkPrintOptions(slug, {
    allowed: { paper: seededAllowedPapers },
  })

  try {
    await openWizard(page, slug)

    // TPS bundles printType + paper into a single "Print" section with two
    // SelectDropdowns labeled "Type" and "Paper". Papers cascade on the
    // chosen print type (Giclée vs C-Type). The vetoed paper must be
    // hidden under either branch — iterate every print-type entry so the
    // assertion holds regardless of which branch the vetoed paper lives on.
    const printTypeLabels = await readWizardOptions(page, 'Print', 'Type')
    expect(printTypeLabels.length, 'TPS wizard should expose ≥1 print type').toBeGreaterThan(0)

    const seenPapers = new Set<string>()
    for (const printTypeLabel of printTypeLabels) {
      await pickWizardOption(page, 'Print', printTypeLabel, 'Type')
      const papersUnderType = await readWizardOptions(page, 'Print', 'Paper')
      expect(
        papersUnderType,
        `vetoed paper "${vetoedPaper.label}" should NOT appear under print type "${printTypeLabel}"`,
      ).not.toContain(vetoedPaper.label)
      papersUnderType.forEach((p) => seenPapers.add(p))
    }

    expect(seenPapers.size, 'TPS wizard should expose ≥1 paper across print types').toBeGreaterThan(
      0,
    )
  } finally {
    await restoreArtworkPrintOptions(slug, previousPrintOptions)
  }
})
