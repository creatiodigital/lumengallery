# Google Places in checkout

Address autocomplete on the checkout address step. Suggestions come from Google,
the dropdown is ours, and the whole thing is optional at runtime.

## Architecture: the key never reaches the browser

The obvious build puts a `NEXT_PUBLIC_` Maps key in the page and calls Google
from the browser. We deliberately do not.

Any `NEXT_PUBLIC_` key is readable by anyone who views source. The usual defence
is HTTP referrer restrictions — but those are enforced by the _browser_, and a
server-side caller forges the header in one line:

```
curl -H "Referer: https://theartroom.gallery" https://maps.googleapis.com/...
```

So referrer restrictions stop casual reuse on someone else's website and do
nothing about deliberate abuse. The bill arrives either way.

Instead the browser talks to `/api/checkout/address-lookup` and that route talks
to Google, holding a **server-only** key. What this buys:

- **Per-IP rate limits** on the same durable Postgres limiter that guards login.
  A stolen endpoint is throttled; a stolen key is not.
- **A hard daily ceiling of our own**, so the free tier cannot be burned through
  overnight.
- **No Google script in the buyer's page at all** — nothing loads for anyone who
  never reaches the address field, which is a cleaner consent story given the
  cookie banner.
- **Nothing to add to a Content-Security-Policy** later.

## Turning it on

One environment variable, **not** `NEXT_PUBLIC_`:

```
GOOGLE_MAPS_API_KEY=AIzaSyD6NMGq5wZaYAfXSiD_amYPrdeWFcccM-k
```

`.env.local` for development, Vercel project settings for staging and
production. The checkout page reads it server-side and passes a plain boolean to
the form, so the browser learns only _whether_ autocomplete exists.

Optional ceilings (defaults in `route.ts`):

```
ADDRESS_LOOKUP_DAILY_CAP=300           # billed Place Details calls per day
ADDRESS_LOOKUP_DAILY_SUGGEST_CAP=5000  # autocomplete calls per day
```

### On the Google Cloud side

Use the existing project (`theartroom-501511`, the one already serving the GA4
Data API).

1. Enable **Places API (New)**. The legacy Places API is a different product;
   this code calls the New REST endpoints (`places:autocomplete`, `places/{id}`).
2. Billing must be enabled on the project.
3. Create an API key and restrict it:
   - _Application restrictions_ → **None**, or IP addresses if you pin Vercel's
     egress. Do **not** use HTTP referrers — the caller is our server, which
     sends no referrer.
   - _API restrictions_ → Places API (New) only.
4. **Set a quota cap** (APIs & Services → Places API (New) → Quotas) and a
   **budget alert** on the project. Our own daily cap is the first line of
   defence; these are the second.

Because the key is server-only it is never exposed, so a leak requires access to
the Vercel environment rather than the ability to press View Source.

## Rate limits and what the buyer sees

| Limit           | Default     | Purpose                                           |
| --------------- | ----------- | ------------------------------------------------- |
| suggest, per IP | 60 / 10 min | a real buyer debounces into a handful per address |
| details, per IP | 20 / 10 min | one per completed address                         |
| suggest, global | 5,000 / day | protects Google's quota                           |
| details, global | 300 / day   | keeps us inside the 10,000/month free tier        |

When any of them trips — or the key is missing, or Google is unreachable — the
route returns a shaped `{ ok: false, reason }` and the field **switches to
manual entry with one quiet line**:

> Address suggestions are busy right now — please type your address below.
> Everything else works normally.

Whatever the buyer had typed is kept. Nothing about the sale is blocked. That is
the whole contract: this feature is allowed to fail, and it is never allowed to
cost an order.

## Without a key

Everything degrades to the plain manual address form that existed before. No
error, no warning, no broken layout. The same path is taken when the buyer is
offline or the route is unreachable.

This is also why the e2e suite, which has no key, still exercises the manual
path on every run.

## Cost shape

Billing is per _session_, not per keystroke. A session covers all the
autocomplete requests for one address plus the single Place Details call that
follows, and is held in `AutocompleteSessionToken`. The code mints one lazily on
the first search and discards it after a selection, so one completed address is
one billable session. Two guards keep the request count down: a 220 ms debounce,
and a 3-character minimum before anything is sent.

## Why the country dropdown drives the search

Google caps `includedRegionCodes` at 15 regions. We ship to 38. So "restrict
suggestions to our shipping list" cannot be expressed in a single call.

Instead the form's own country field scopes the search to one country at a time —
within the cap, and considerably more accurate than a 15-way search would have
been. Changing the country re-scopes what has already been typed. If Google's
resolved country disagrees with the buyer's selection, Google wins: it read the
actual address.

## The region field

`administrative_area_level_1`'s short text is the ISO 3166-2 subdivision code.
That is the postal convention in the **US, Canada and Australia** (`DC`, `ON`,
`QLD`) and nowhere else in our 38 countries.

Taking it everywhere produced `MD` for Madrid — a code no Spanish courier uses,
and Maryland's code on an international label. UK addresses were worse: they
have no level 1, so the field came back **empty**.

The rule now:

| destination     | source                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| US, CA, AU      | `administrative_area_level_1` **short** code                                                               |
| everywhere else | `administrative_area_level_2` name (province / county), falling back to `administrative_area_level_1` name |

So Spain gives `Madrid` (the province, which is what a Spanish label carries —
duplicating the city is correct there), the UK gives `Greater London`, and
Germany gives `Bayern` rather than `BY`. Pinned in
`e2e/place-to-address.spec.ts`.

## Chrome autofill

Chrome has ignored `autocomplete="off"` for autofill since 2014, and classifies
fields by `name` and `id` as well as by token. So a field called `address1`
sitting beside `postal-code` and `address-level2` siblings gets Chrome's own
address dropdown regardless of what `autocomplete` says — stacked on top of
ours, two menus on one field.

The only thing that reliably suppresses it is a token Chrome does not recognise:
it autofills allow-listed tokens only. Hence `address-line1-search` rather than
`address-line1`.

**Suppression covers the whole address block, not just the street.** Killing
Chrome on the street line alone produces the worst outcome of the three: Chrome
fills city, region and postcode from a saved profile while the street stays
blank, handing the buyer a half-filled address with no obvious way to finish it.

The rule is therefore one mechanism per address:

|                                     | Places active                                 | Places dark / manual entry |
| ----------------------------------- | --------------------------------------------- | -------------------------- |
| street, apt, city, region, postcode | Chrome suppressed — our suggestions fill them | full Chrome autofill       |
| name, email, phone                  | full Chrome autofill                          | full Chrome autofill       |

Identity fields are never suppressed. Nothing of ours competes there, and they
are exactly what a returning buyer wants filled in for them.

Choosing "Enter address manually" flips the whole block back to standard tokens,
so opting out of our suggestions hands Chrome autofill back rather than leaving
the buyer with neither. `e2e/checkout-address-help.spec.ts` pins the tokens in
the no-key state.

## The street-line problem

Google returns `street_number` and `route` as separate components and never says
what order they go in, because the answer is cultural — "21 Rue Boissy d'Anglas"
in France, "Calle de Serrano 21" in Spain. `placeToAddress` holds a set of
number-first countries and defaults to number-last, which is the majority of our
shipping list. Getting this backwards produces an address that is structurally
complete and reads as wrong to the person receiving the parcel, and we print it
on the label. `e2e/place-to-address.spec.ts` pins it.

## What is NOT covered by tests

The live autocomplete dropdown — typing, suggestions appearing, keyboard
selection, and the fields being filled from a real place — has **no automated
coverage**, because the suite has no API key and stubbing Google's loader
globally would make every other checkout spec hit the network.

Covered instead:

- `e2e/place-to-address.spec.ts` — the component→field mapping, including the
  locale trap above. This is where the real complexity lives.
- `e2e/checkout-address-help.spec.ts` — the no-key degradation path, the
  double-check warning, and the shipping-countries modal.

**Verify by hand after adding the key**, on staging: type a partial address, pick
a suggestion, confirm city / postal code / country all populate correctly, then
confirm "Enter address manually" keeps whatever was typed. Worth adding to the
staging runbook as its own item.
