import { expect, type Page } from '@playwright/test'

import { routes } from './fixtures'

/**
 * Provider-agnostic wizard interaction helpers.
 *
 * The wizard is built around `Catalog` — a provider-emitted shape
 * the buyer drives through CollapsibleSections + SelectDropdowns.
 * These helpers operate on that DOM contract (sections rendered as
 * `<section>` with an `aria-expanded` header button, dropdowns
 * exposing `aria-haspopup="listbox"` + `<ul role="listbox">`) and so
 * are provider-agnostic — operate purely on the catalog DOM contract.
 */

/** Open the public wizard for an artwork. Country lives on the
 *  checkout step now; the wizard renders all options immediately. */
export async function openWizard(page: Page, slug: string): Promise<void> {
  const response = await page.goto(routes.printWizard(slug))
  expect(response?.status(), 'wizard should respond 2xx').toBeLessThan(400)
}

/** Pick a destination country from the country dropdown on the
 *  checkout step (the address form's first field). */
export async function pickCheckoutCountry(page: Page, country: string): Promise<void> {
  await page.getByRole('button', { name: /choose a country/i }).click()
  await page.getByRole('option', { name: new RegExp(country, 'i') }).click()
}

/**
 * Read option labels from a SelectDropdown inside the named CollapsibleSection.
 * Each section is rendered as `<section><button aria-expanded>{title}</button>
 * <div>...SelectDropdown...</div></section>`; the dropdown trigger inside
 * has `aria-haspopup="listbox"` and opens a `<ul role="listbox">`.
 *
 * Some sections (TPS "Print", "Frame") group several SelectDropdowns. Pass
 * `fieldLabel` to disambiguate by the dropdown's label `<span>` — when omitted,
 * the first dropdown in the section is used.
 */
export async function readWizardOptions(
  page: Page,
  sectionTitle: string,
  fieldLabel?: string,
): Promise<string[]> {
  const section = sectionLocator(page, sectionTitle)
  await expect(section, `wizard section "${sectionTitle}" should render`).toBeVisible({
    timeout: 30_000,
  })
  await ensureSectionOpen(section, sectionTitle)
  const trigger = fieldLabel ? labeledTrigger(section, fieldLabel) : firstTrigger(section)
  await trigger.click()
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible({ timeout: 5_000 })
  const labels = await listbox.getByRole('option').allTextContents()
  await page.keyboard.press('Escape')
  return labels.map((l) => l.trim()).filter(Boolean)
}

/**
 * Pick a value from a SelectDropdown inside the named section. Pass
 * `fieldLabel` to target a specific dropdown in a grouped section
 * (e.g. TPS "Print" → "Type" / "Paper").
 */
export async function pickWizardOption(
  page: Page,
  sectionTitle: string,
  optionLabel: string,
  fieldLabel?: string,
): Promise<void> {
  const section = sectionLocator(page, sectionTitle)
  await ensureSectionOpen(section, sectionTitle)
  const trigger = fieldLabel ? labeledTrigger(section, fieldLabel) : firstTrigger(section)
  await trigger.click()
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible({ timeout: 5_000 })
  await listbox.getByRole('option', { name: optionLabel, exact: true }).click()
}

/**
 * Strips formatting noise so a catalog string ("25×20 cm (10×8″)") and
 * the wizard's formatted variant ("25 × 20 cm (10.0″ × 8.0″)") compare
 * equal.
 */
export function normaliseSizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(\d)\.0(?!\d)/g, '$1')
    .replace(/x/g, '×')
}

function sectionLocator(page: Page, title: string) {
  return page.locator('section').filter({
    has: page.getByRole('button', { name: new RegExp(`^${title}$`, 'i') }),
  })
}

function firstTrigger(section: ReturnType<Page['locator']>) {
  return section.locator('button[aria-haspopup="listbox"]').first()
}

/**
 * SelectDropdown markup is `<div class="wrapper"><span class="label">{label}</span>
 * <button aria-haspopup="listbox">…</button>…</div>`. We find the label span by
 * exact text and walk to the immediately-following listbox button so grouped
 * sections (TPS "Print" → "Type" / "Paper") can be addressed by the dropdown
 * label rather than positional index.
 */
function labeledTrigger(section: ReturnType<Page['locator']>, fieldLabel: string) {
  return section
    .locator('span', { hasText: new RegExp(`^${fieldLabel}$`) })
    .locator('xpath=following-sibling::button[@aria-haspopup="listbox"][1]')
    .first()
}

async function ensureSectionOpen(
  section: ReturnType<Page['locator']>,
  title: string,
): Promise<void> {
  const header = section.getByRole('button', { name: new RegExp(`^${title}$`, 'i') }).first()
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click()
  }
}
