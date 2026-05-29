/**
 * Cookie-consent state shared between the cookie banner, the Google
 * Analytics loader, and the footer "Cookie settings" trigger.
 *
 * We store an explicit decision (not a binary "dismissed" flag) so we know
 * *what* the user consented to and *when* — a GDPR requirement. Analytics
 * (GA4) never runs until `analytics` is true.
 */

export type ConsentState = {
  analytics: boolean
  timestamp: string
}

const STORAGE_KEY = 'cookie-consent'

/** Fired whenever the user makes/changes a choice. */
export const CONSENT_CHANGE_EVENT = 'consent-change'
/** Fired by the footer link to re-open the banner so a choice can be changed. */
export const OPEN_COOKIE_SETTINGS_EVENT = 'open-cookie-settings'

/**
 * Returns the stored consent, or null when no decision has been made yet.
 * A legacy value (the old `'dismissed'` string) is treated as "no decision"
 * so those users are asked once, properly.
 */
export const getConsent = (): ConsentState | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ConsentState>
    if (typeof parsed?.analytics === 'boolean' && typeof parsed?.timestamp === 'string') {
      return { analytics: parsed.analytics, timestamp: parsed.timestamp }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Pushes the consent decision into Google Consent Mode v2. Safe to call even
 * if gtag hasn't loaded — the GA loader replays stored consent on startup.
 */
export const updateGtagConsent = (analytics: boolean): void => {
  if (typeof window === 'undefined') return
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
  if (typeof gtag === 'function') {
    gtag('consent', 'update', {
      analytics_storage: analytics ? 'granted' : 'denied',
    })
  }
}

/** Persists the decision, updates Consent Mode, and notifies listeners. */
export const setConsent = (analytics: boolean): ConsentState => {
  const state: ConsentState = { analytics, timestamp: new Date().toISOString() }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    updateGtagConsent(analytics)
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: state }))
  }
  return state
}

/** Re-opens the cookie banner (used by the footer "Cookie settings" link). */
export const openCookieSettings = (): void => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
}
