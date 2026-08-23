'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { Input } from '@/components/ui/Input'
import {
  fetchAddressDetails,
  fetchAddressSuggestions,
  newSessionToken,
  type AddressSuggestion,
  type LookupFailure,
} from '@/lib/checkout/addressLookup'
import type { MappedAddress } from '@/lib/checkout/placeToAddress'

import styles from './AddressForm.module.scss'

/** Keystrokes settle for this long before we spend a request. */
const DEBOUNCE_MS = 220
/** Below this, suggestions are noise and every keystroke is billed. */
const MIN_QUERY = 3

type AddressAutocompleteProps = {
  /** The Address field's value — owned by the parent form. */
  value: string
  onChange: (next: string) => void
  /** Scopes the search. Google caps region codes at 15 and we ship to 38, so
   *  the form's own country choice is what makes this expressible at all. */
  countryCode: string
  /** Fired when a suggestion is chosen — fills the rest of the form. */
  onPlaceSelected: (address: MappedAddress) => void
  /** Suggestions have stopped working — the parent switches to manual entry and
   *  explains why. Separate from `onEnterManually` because one is the buyer's
   *  choice and the other is our failure, and they read differently. */
  onUnavailable: (reason: LookupFailure) => void
  invalid?: boolean
  inputId: string
}

/**
 * Address field with Google Places suggestions and our own dropdown.
 *
 * The dropdown is ours rather than Google's `PlaceAutocompleteElement` because
 * this is the most important moment in the buyer's flow, and a shadow-DOM web
 * component with its own styling would read as somebody else's control sitting
 * between our fields.
 *
 * Degrades to a plain input whenever Places is unavailable — no key, blocked
 * script, offline, rejected referrer. A dead autocomplete must never be able to
 * stop someone buying a print, so every failure here is silent and lands the
 * buyer on manual entry rather than on an error.
 */
export const AddressAutocomplete = ({
  value,
  onChange,
  countryCode,
  onPlaceSelected,
  onUnavailable,
  invalid,
  inputId,
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [resolving, setResolving] = useState(false)
  const listId = useId()

  const sessionRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Click-away closes the list without touching what was typed.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  /**
   * Latest callbacks, held in a ref.
   *
   * The parent passes inline arrows, so these are new function identities on
   * every render. Depending on them directly made the debounced effect tear
   * down and re-schedule on every render — and because each pass bumped a
   * shared request counter, every in-flight response was then discarded as
   * "stale" before it could render suggestions OR report a failure. The field
   * sat there doing nothing, silently, which is exactly what it looked like.
   *
   * A ref keeps the callbacks current without making them dependencies.
   */
  const callbacksRef = useRef({ onUnavailable, onPlaceSelected, onChange })
  useEffect(() => {
    callbacksRef.current = { onUnavailable, onPlaceSelected, onChange }
  })

  // Debounced search. Depends ONLY on what should retrigger a lookup: the text
  // and the country scoping it. Staleness is handled by the `cancelled` flag,
  // which belongs to this effect instance — unlike a shared counter, it cannot
  // be advanced by an unrelated re-render.
  useEffect(() => {
    const query = value.trim()
    if (query.length < MIN_QUERY || !countryCode) {
      // Return the SAME array when already empty. A fresh `[]` is a new
      // reference, so React would re-render, which is what turned this into a
      // loop in the first place.
      setSuggestions((prev) => (prev.length === 0 ? prev : []))
      setOpen(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        // One billing session spans every keystroke for this address plus the
        // details call that closes it.
        if (!sessionRef.current) sessionRef.current = newSessionToken()
        const result = await fetchAddressSuggestions(query, countryCode, sessionRef.current)
        if (cancelled) return
        if (!result.ok) {
          // Throttled, switched off, or Google unreachable. Say so once and
          // hand over the manual form — an empty dropdown that never fills just
          // looks broken, and there is a sale waiting behind this field.
          callbacksRef.current.onUnavailable(result.reason)
          return
        }
        setSuggestions(result.suggestions)
        setActiveIndex(-1)
        setOpen(result.suggestions.length > 0)
      })()
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, countryCode])

  const choose = async (suggestion: AddressSuggestion) => {
    setOpen(false)
    setResolving(true)
    const result = await fetchAddressDetails(suggestion.placeId, sessionRef.current ?? '')
    // The session ends with the details call either way — a new one is minted
    // on the next search.
    sessionRef.current = null
    setResolving(false)

    if (!result.ok) {
      // Couldn't expand it. Keep what they picked as text so the field is not
      // left empty, and let them correct it by hand.
      onChange(`${suggestion.primary}${suggestion.secondary ? `, ${suggestion.secondary}` : ''}`)
      onUnavailable(result.reason)
      return
    }
    onPlaceSelected(result.address)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      // Only swallow Enter when a suggestion is actually highlighted, so Enter
      // still submits the form the rest of the time.
      e.preventDefault()
      void choose(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={styles.autocomplete} ref={containerRef}>
      <Input
        id={inputId}
        name="address1"
        size="bare"
        inputClassName={styles.fieldInput}
        type="text"
        // NOT "off". Chrome has deliberately ignored autocomplete="off" for
        // autofill since 2014, so "off" here would still let its own address
        // dropdown stack on top of ours. A token that is SEMANTIC but not on
        // Chrome's allow-list is what actually suppresses it — Chrome only
        // autofills fields whose token it recognises.
        autoComplete="address-line1-search"
        required
        maxLength={200}
        invalid={invalid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      />

      {open && suggestions.length > 0 && (
        <ul className={styles.suggestions} id={listId} role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={i === activeIndex ? styles.suggestionActive : styles.suggestion}
              onMouseEnter={() => setActiveIndex(i)}
              onPointerDown={(e) => {
                // Commit on pointerdown — blur would close the list first.
                e.preventDefault()
                void choose(s)
              }}
            >
              <span className={styles.suggestionPrimary}>{s.primary}</span>
              {s.secondary && <span className={styles.suggestionSecondary}>{s.secondary}</span>}
            </li>
          ))}
        </ul>
      )}

      {resolving && <span className={styles.autocompleteStatus}>Looking up that address…</span>}
    </div>
  )
}
