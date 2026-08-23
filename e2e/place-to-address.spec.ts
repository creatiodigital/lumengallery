import { test, expect } from '@playwright/test'

import { placeToAddress } from '../src/lib/checkout/placeToAddress'

/**
 * Google returns an address as a bag of typed components, never as the line1 /
 * city / postcode our form (and the carrier label) needs. This is that mapping.
 *
 * The hard part is the street line. Google gives `street_number` and `route`
 * separately and NEVER says which order they go in, because the answer is
 * cultural: "21 Rue Boissy" in France, "Calle de Serrano 21" in Spain. Getting
 * it backwards produces an address that is technically complete and looks wrong
 * to the person receiving the parcel — and we print it on the label.
 *
 * Pure — no network, no browser, no Google.
 */

const c = (types: string[], longText: string, shortText = longText) => ({
  types,
  longText,
  shortText,
})

test('a Spanish address puts the number after the street', () => {
  const addr = placeToAddress(
    [
      c(['street_number'], '21'),
      c(['route'], 'Calle de Serrano'),
      c(['locality'], 'Madrid'),
      c(['administrative_area_level_1'], 'Comunidad de Madrid', 'MD'),
      c(['postal_code'], '28001'),
      c(['country'], 'Spain', 'ES'),
    ],
    'Calle de Serrano, 21, 28001 Madrid, Spain',
  )
  expect(addr.address1).toBe('Calle de Serrano 21')
  expect(addr.city).toBe('Madrid')
  expect(addr.postalCode).toBe('28001')
  expect(addr.countryCode).toBe('ES')
})

test('a French address puts the number before the street', () => {
  const addr = placeToAddress(
    [
      c(['street_number'], '21'),
      c(['route'], 'Rue Boissy d’Anglas'),
      c(['locality'], 'Paris'),
      c(['postal_code'], '75008'),
      c(['country'], 'France', 'FR'),
    ],
    '21 Rue Boissy d’Anglas, 75008 Paris, France',
  )
  expect(addr.address1).toBe('21 Rue Boissy d’Anglas')
})

test('a US address puts the number before the street', () => {
  const addr = placeToAddress(
    [
      c(['street_number'], '1600'),
      c(['route'], 'Pennsylvania Avenue NW'),
      c(['locality'], 'Washington'),
      c(['administrative_area_level_1'], 'District of Columbia', 'DC'),
      c(['postal_code'], '20500'),
      c(['country'], 'United States', 'US'),
    ],
    '1600 Pennsylvania Avenue NW, Washington, DC 20500, USA',
  )
  expect(addr.address1).toBe('1600 Pennsylvania Avenue NW')
  expect(addr.stateOrRegion).toBe('DC')
})

/**
 * STATE / REGION is where a naive "just take the short code" rule goes wrong.
 *
 * Google's `administrative_area_level_1` short text is the ISO 3166-2 code:
 * `ES-MD` for Comunidad de Madrid, so `MD`. That is right for the US and
 * Canada, where `DC` and `ON` are what a label carries — and wrong nearly
 * everywhere else. A Spanish parcel names the PROVINCE, `Madrid`; `MD` means
 * nothing to a courier there and collides with Maryland on an international
 * label.
 */
test('a Spanish address names the province, not the ISO region code', () => {
  const addr = placeToAddress(
    [
      c(['locality'], 'Madrid'),
      c(['administrative_area_level_2'], 'Madrid', 'M'),
      c(['administrative_area_level_1'], 'Comunidad de Madrid', 'MD'),
      c(['country'], 'Spain', 'ES'),
    ],
    '',
  )
  expect(addr.stateOrRegion).toBe('Madrid')
})

test('a country with NO region field gets an EMPTY region, not a guess', () => {
  // Google's address metadata is the authority here (the data behind Chrome
  // autofill). The UK's format is `%N%n%O%n%A%n%C%n%Z` — no `%S` anywhere, so
  // there IS no region line on a British address. Filling one with the county
  // Google happens to return invents a field the destination does not post.
  const uk = placeToAddress(
    [
      c(['postal_town'], 'London'),
      c(['administrative_area_level_2'], 'Greater London'),
      c(['country'], 'United Kingdom', 'GB'),
    ],
    '',
  )
  expect(uk.city).toBe('London')
  expect(uk.stateOrRegion).toBe('')

  // Same for France (`%Z %C`) and Germany (`%Z %C`) — a département or a
  // Landkreis in the region field is invented data on a parcel label.
  const fr = placeToAddress(
    [c(['administrative_area_level_2'], 'Paris'), c(['country'], 'France', 'FR')],
    '',
  )
  expect(fr.stateOrRegion).toBe('')

  const de = placeToAddress(
    [c(['administrative_area_level_1'], 'Bayern', 'BY'), c(['country'], 'Germany', 'DE')],
    '',
  )
  expect(de.stateOrRegion).toBe('')
})

test('Japan takes its region from level 1 — the prefecture, not the ward', () => {
  // JP posts `〒%Z%n%S%n%A`, and `%S` is the prefecture. Level 2 there is the
  // ward, which would be wrong — the same "province" rule that is right for
  // Spain is wrong here.
  const addr = placeToAddress(
    [
      c(['locality'], 'Chiyoda City'),
      c(['administrative_area_level_1'], 'Tokyo'),
      c(['country'], 'Japan', 'JP'),
    ],
    '',
  )
  expect(addr.stateOrRegion).toBe('Tokyo')
})

test('Canada keeps its short province code', () => {
  // CA, US and AU are the countries where the code IS the postal convention.
  const addr = placeToAddress(
    [c(['administrative_area_level_1'], 'Ontario', 'ON'), c(['country'], 'Canada', 'CA')],
    '',
  )
  expect(addr.stateOrRegion).toBe('ON')
})

test('street order is read from Google’s own formatting, not from a country list', () => {
  // The same two components, the same country code, opposite orders in
  // `formattedAddress` — the output follows the formatting, which is the only
  // non-guessed evidence available.
  const comps = [
    c(['street_number'], '21'),
    c(['route'], 'Calle Mayor'),
    c(['country'], 'Spain', 'ES'),
  ]
  expect(placeToAddress(comps, 'Calle Mayor, 21, 28021 Madrid, Spain').address1).toBe(
    'Calle Mayor 21',
  )
  expect(placeToAddress(comps, '21 Calle Mayor, 28021 Madrid, Spain').address1).toBe(
    '21 Calle Mayor',
  )
})

test('a house number that also appears inside the postcode does not flip the order', () => {
  // "21" occurs in "28021". Matching it loosely would read every such address
  // as number-first and print the street line backwards.
  const addr = placeToAddress(
    [c(['street_number'], '21'), c(['route'], 'Calle Mayor'), c(['country'], 'Spain', 'ES')],
    'Calle Mayor, 21, 28021 Madrid, Spain',
  )
  expect(addr.address1).toBe('Calle Mayor 21')
})

test('the country code is the SHORT text — our whole catalogue is keyed on it', () => {
  // supportedCountries, VAT and shipping all compare against 'ES', never 'Spain'.
  const addr = placeToAddress([c(['country'], 'Germany', 'DE')], 'Germany')
  expect(addr.countryCode).toBe('DE')
})

test('a UK address reads its town from postal_town, which has no locality', () => {
  // London addresses routinely carry postal_town + a borough as locality's
  // stand-in; taking the first admin area instead yields "Greater London".
  const addr = placeToAddress(
    [
      c(['street_number'], '10'),
      c(['route'], 'Downing Street'),
      c(['postal_town'], 'London'),
      c(['administrative_area_level_2'], 'Greater London'),
      c(['postal_code'], 'SW1A 2AA'),
      c(['country'], 'United Kingdom', 'GB'),
    ],
    '10 Downing St, London SW1A 2AA, UK',
  )
  expect(addr.city).toBe('London')
})

test('a postal code suffix is joined on, not dropped', () => {
  const addr = placeToAddress(
    [c(['postal_code'], '20500'), c(['postal_code_suffix'], '0003'), c(['country'], 'USA', 'US')],
    '',
  )
  expect(addr.postalCode).toBe('20500-0003')
})

test('a subpremise becomes the apartment line, not part of the street', () => {
  const addr = placeToAddress(
    [
      c(['subpremise'], 'Apt 4B'),
      c(['street_number'], '21'),
      c(['route'], 'Calle de Serrano'),
      c(['country'], 'Spain', 'ES'),
    ],
    '',
  )
  expect(addr.address2).toBe('Apt 4B')
  expect(addr.address1).toBe('Calle de Serrano 21')
})

test('a street with no number is still a usable line', () => {
  // Rural and named-building addresses often have no street_number at all.
  const addr = placeToAddress(
    [c(['route'], 'Camino de los Álamos'), c(['country'], 'Spain', 'ES')],
    'Camino de los Álamos, Spain',
  )
  expect(addr.address1).toBe('Camino de los Álamos')
})

test('an unrecognisable place falls back to the formatted address, never to empty', () => {
  // A plus-code or a named landmark can arrive with no route at all. Handing the
  // buyer a blank Address box after they picked a suggestion is the worst
  // outcome; the formatted string is at least something to correct.
  const addr = placeToAddress([c(['country'], 'Spain', 'ES')], 'Museo del Prado, Madrid, Spain')
  expect(addr.address1).toBe('Museo del Prado, Madrid, Spain')
})

test('missing components come back as empty strings, never undefined', () => {
  // Every consumer trims and assigns these straight onto a ShippingAddress.
  const addr = placeToAddress([], '')
  expect(addr).toEqual({
    address1: '',
    address2: '',
    city: '',
    stateOrRegion: '',
    postalCode: '',
    countryCode: '',
  })
})
