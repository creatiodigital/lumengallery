import { test, expect, type Page } from '@playwright/test'

import prisma from '@/lib/prisma'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'
import { routes } from './fixtures'

/**
 * Two invariants the artwork card must hold at the same time, on every grid.
 *
 *   1. Dividers land on ONE continuous line across a row.
 *   2. Images are centred vertically within the shared image band.
 *
 * They are easy to satisfy one at a time and easy to break in pairs, which is
 * why this is a test and not a comment. `align-items: center` on the card
 * centres the image — and also centres the caption in its own row, so a short
 * caption sinks and its rule drops below its neighbour's. `align-self: end` on
 * the image wrapper keeps the rules honest — and bottom-pins every image, so a
 * landscape work hangs level with the foot of a portrait one instead of beside
 * its middle.
 *
 * Asserted as geometry rather than CSS so any implementation that genuinely
 * holds both is allowed to pass.
 */

type CardBox = {
  row: number
  title: string
  imgMid: number | null
  imgTop: number | null
  imgBottom: number | null
  dividerTop: number
}

/** Every card on the page, tagged with the visual row it sits in. */
async function readCards(page: Page): Promise<CardBox[]> {
  return page.evaluate(() => {
    const isPart = (el: Element, part: string) =>
      typeof el.className === 'string' &&
      el.className.includes('ArtworkGrid-module') &&
      el.className.includes('__' + part)

    const grid = [...document.querySelectorAll('div')].find((e) => isPart(e, 'grid'))
    if (!grid) return []

    const cards = [...grid.children].map((card) => {
      const info = [...card.querySelectorAll('div')].find((e) => isPart(e, 'info'))
      const img = card.querySelector('img')
      const i = img?.getBoundingClientRect()
      return {
        cardTop: Math.round(card.getBoundingClientRect().top),
        title: card.querySelector('h1')?.textContent?.trim() ?? '(untitled)',
        imgMid: i ? (i.top + i.bottom) / 2 : null,
        imgTop: i ? i.top : null,
        imgBottom: i ? i.bottom : null,
        dividerTop: info ? info.getBoundingClientRect().top : NaN,
      }
    })

    // Cards sharing a top edge are one visual row — that is the scope both
    // invariants apply to.
    const tops = [...new Set(cards.map((c) => c.cardTop))].sort((a, b) => a - b)
    return cards.map(({ cardTop, ...rest }) => ({ row: tops.indexOf(cardTop), ...rest }))
  })
}

const spread = (values: number[]) => Math.max(...values) - Math.min(...values)

/** Rows holding more than one card — a single card is trivially aligned. */
function multiCardRows(cards: CardBox[]): Map<number, CardBox[]> {
  const rows = new Map<number, CardBox[]>()
  for (const card of cards) rows.set(card.row, [...(rows.get(card.row) ?? []), card])
  return new Map([...rows].filter(([, group]) => group.length > 1))
}

async function assertAlignment(page: Page, where: string) {
  // Images settle their layout only once loaded; an unsettled row reports
  // stale boxes and would make this pass for the wrong reason.
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  const rows = multiCardRows(await readCards(page))
  expect(rows.size, `${where}: no multi-card row to assert on`).toBeGreaterThan(0)

  for (const [row, group] of rows) {
    const titles = group.map((c) => c.title).join(' | ')

    expect(
      spread(group.map((c) => c.dividerTop)),
      `${where} row ${row}: dividers must sit on one line — ${titles}`,
    ).toBeLessThanOrEqual(1)

    const mids = group.map((c) => c.imgMid).filter((m): m is number => m !== null)
    if (mids.length > 1) {
      expect(
        spread(mids),
        `${where} row ${row}: images must share a vertical centre — ${titles}`,
      ).toBeLessThanOrEqual(1)
    }
  }
}

test('the exhibition grid aligns dividers and image centres', async ({ page }) => {
  await page.goto(routes.exhibition())
  await assertAlignment(page, 'exhibition')
})

test('the artist grid aligns dividers and image centres', async ({ page }) => {
  await page.goto(routes.artistProfile())
  await assertAlignment(page, 'artist')
})

test('the prints grid aligns dividers and image centres', async ({ page }) => {
  // Unlike the artist/exhibition grids, /prints has no ambient inventory of its
  // own now — it renders only the gallery's curated selection (AR-140), which
  // is empty until someone curates it. Seed two so there is a row to assert on.
  const a = await setupLimitedFixture(2)
  const b = await setupLimitedFixture(2)
  try {
    await prisma.artwork.update({ where: { id: a.artworkId }, data: { printPriceCents: null } })
    await prisma.artwork.update({ where: { id: b.artworkId }, data: { printPriceCents: null } })
    await prisma.selectedPrint.createMany({
      data: [
        { artworkId: a.artworkId, order: 0 },
        { artworkId: b.artworkId, order: 1 },
      ],
    })

    await page.goto('/prints')
    await assertAlignment(page, 'prints')
  } finally {
    await prisma.selectedPrint.deleteMany({
      where: { artworkId: { in: [a.artworkId, b.artworkId] } },
    })
    await teardownLimitedFixture(a)
    await teardownLimitedFixture(b)
  }
})
