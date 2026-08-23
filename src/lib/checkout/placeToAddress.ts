/**
 * Turn a Google Place's address components into the fields our form, our
 * carrier label and our invoice actually use.
 *
 * Google never returns a "line 1". It returns a bag of typed components and
 * leaves the assembly to you — including the one decision it cannot make for
 * you, which is what order the street number and the street name go in. That is
 * cultural, not structural: "21 Rue Boissy d'Anglas" in France, "Calle de
 * Serrano 21" in Spain. Both are the same two components in opposite orders,
 * and getting it backwards prints an address on a parcel label that is
 * technically complete and reads as wrong to the person receiving it.
 *
 * Pure and dependency-free on purpose: no Google types, no network, no DOM. The
 * caller hands over plain component records, so this stays testable without a
 * browser or an API key.
 */

/** The shape of a Places (New) address component, structurally typed. */
export type PlaceAddressComponent = {
  types: string[]
  longText: string
  shortText: string
}

export type MappedAddress = {
  address1: string
  address2: string
  city: string
  stateOrRegion: string
  postalCode: string
  countryCode: string
}

/**
 * Where each country's region field comes from — and, crucially, which
 * countries have no region field at all.
 *
 * Derived from Google's own address-format metadata (the data behind Chrome
 * autofill: https://chromium-i18n.appspot.com/ssl-address/data/<CC>), read for
 * all 38 countries we ship to. `%S` in a country's `fmt` string means the
 * postal format HAS a region line; its absence means it does not.
 *
 * Of our 38, only 12 use one. For the other 26 — France, Germany, the UK, the
 * Netherlands, Portugal, Poland, the Nordics and more — filling a region is
 * inventing data: France's format is `%O%n%N%n%A%n%Z %C`, with no region line
 * anywhere. Putting a département or a Landkreis there produces a parcel label
 * carrying a field the destination's post office does not use.
 *
 * Three shapes among the twelve:
 *   - `level1-code`  US, CA, AU — the ISO subdivision code IS the convention
 *                    ("DC", "ON", "QLD"), confirmed by state_name_type: state.
 *   - `level1-name`  JP, KR — prefecture / do-si, which is level 1. Level 2
 *                    there is the ward, and would be wrong.
 *   - `province`     ES, IT, IE, EE, LV, LT, RO — the province or county,
 *                    which Google returns as administrative_area_level_2.
 *                    Spain posts "28001 Madrid Madrid": city then province.
 */
type RegionSource = 'level1-code' | 'level1-name' | 'province'

const REGION_SOURCE: Record<string, RegionSource> = {
  US: 'level1-code',
  CA: 'level1-code',
  AU: 'level1-code',
  JP: 'level1-name',
  KR: 'level1-name',
  ES: 'province',
  IT: 'province',
  IE: 'province',
  EE: 'province',
  LV: 'province',
  LT: 'province',
  RO: 'province',
}

/**
 * Which order the street number and street name go in — read out of Google's
 * OWN formatting rather than asserted from a list of countries.
 *
 * "21 Rue Boissy d'Anglas" in France, "Calle de Serrano 21" in Spain: the order
 * is cultural, and hardcoding a country list is guesswork that is wrong for
 * whichever country you forgot. Google already formatted `formattedAddress`
 * correctly for the destination, so the reliable move is to look at what IT
 * did: if the number appears before the street name there, the number goes
 * first here.
 *
 * Returns null when the address gives no evidence either way — a place with no
 * route, or a formatted string that names neither.
 */
function numberPrecedesStreet(
  formattedAddress: string,
  streetNumber: string,
  route: string,
): boolean | null {
  if (!formattedAddress || !streetNumber || !route) return null
  const routeAt = formattedAddress.indexOf(route)
  if (routeAt < 0) return null

  // Only the text BEFORE the street name counts, and the number must appear
  // there as a whole token — otherwise "21" matches the "21" inside a postcode
  // like 28021 and every address looks number-first.
  const before = formattedAddress.slice(0, routeAt)
  const escaped = streetNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u').test(before)
}

/**
 * Last resort only, when `formattedAddress` offers no evidence. Number-last is
 * the majority convention across the countries we ship to (all of continental
 * Europe bar France), so it is the default rather than a second list to keep in
 * sync; these are the exceptions.
 */
const NUMBER_BEFORE_STREET_FALLBACK = new Set(['US', 'CA', 'GB', 'IE', 'AU', 'NZ', 'FR'])

/** First component carrying any of `types`, by the order `types` is given. */
function pick(
  components: PlaceAddressComponent[],
  types: string[],
  form: 'long' | 'short' = 'long',
): string {
  for (const type of types) {
    const hit = components.find((c) => c.types.includes(type))
    if (hit) return (form === 'short' ? hit.shortText : hit.longText) ?? ''
  }
  return ''
}

export function placeToAddress(
  components: PlaceAddressComponent[],
  formattedAddress: string,
): MappedAddress {
  const countryCode = pick(components, ['country'], 'short')
  const streetNumber = pick(components, ['street_number'])
  const route = pick(components, ['route'])

  // Assemble the street line in the destination's own convention. With only one
  // of the two present there is no order to get wrong.
  const numberFirst =
    numberPrecedesStreet(formattedAddress, streetNumber, route) ??
    NUMBER_BEFORE_STREET_FALLBACK.has(countryCode)
  const address1 =
    streetNumber && route
      ? numberFirst
        ? `${streetNumber} ${route}`
        : `${route} ${streetNumber}`
      : // A named building, a rural road or a plus-code arrives with no route at
        // all. Falling back to the formatted address is far better than handing
        // the buyer an empty Address box right after they picked a suggestion —
        // it is at least something to correct rather than nothing to react to.
        route || streetNumber || formattedAddress

  // `locality` is absent on UK addresses, which carry `postal_town` instead;
  // reaching for an admin area there yields "Greater London" rather than
  // "London". Order matters.
  const city = pick(components, [
    'locality',
    'postal_town',
    'sublocality',
    'administrative_area_level_2',
  ])

  // Region, in whatever form the destination actually posts — or EMPTY when the
  // destination has no region line, which is the majority of our countries.
  // Leaving it blank there is the correct answer, not a gap to be helpful about.
  const regionSource = REGION_SOURCE[countryCode]
  const stateOrRegion = !regionSource
    ? ''
    : regionSource === 'level1-code'
      ? pick(components, ['administrative_area_level_1'], 'short')
      : regionSource === 'level1-name'
        ? pick(components, ['administrative_area_level_1'])
        : pick(components, ['administrative_area_level_2', 'administrative_area_level_1'])

  const postalCode = pick(components, ['postal_code'])
  const suffix = pick(components, ['postal_code_suffix'])

  return {
    address1,
    // A unit or apartment is its own line. Folded into the street it produces
    // the "Calle de Serrano 21 Apt 4B" that couriers misread.
    address2: pick(components, ['subpremise']),
    city,
    stateOrRegion,
    postalCode: suffix ? `${postalCode}-${suffix}` : postalCode,
    countryCode,
  }
}
