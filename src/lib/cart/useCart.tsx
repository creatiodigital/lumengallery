'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { cartCount, configKey } from '@/lib/cart/cartMath'
import type { CartItem } from '@/lib/cart/types'

const STORAGE_KEY = 'the-art-room:cart'

type AddItemInput = Omit<CartItem, 'lineId'> & { lineId?: string }

type CartContextValue = {
  items: CartItem[]
  addItem: (item: AddItemInput) => Promise<void>
  removeItem: (lineId: string) => Promise<void>
  // Returns the quantity actually achieved, which may be LESS than requested
  // when a limited-edition reserve falls short of stock. Callers use this to
  // detect a no-op increase (the return is the source of truth, never a ref
  // read in the await-continuation, which is stale before React re-renders).
  setQuantity: (lineId: string, quantity: number) => Promise<number>
  clear: () => Promise<void>
  // Refresh the server TTL on every limited line's holds and re-sync each
  // line's countdown to the server-owned expiry. A no-op for carts with no
  // limited holds. Driven by the cart page heartbeat / buyer activity.
  extendHolds: () => Promise<void>
  count: number
}

const CartContext = createContext<CartContextValue | null>(null)

const readStored = (): CartItem[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CartItem[]) : []
  } catch {
    return []
  }
}

const sameLine = (a: CartItem, b: AddItemInput): boolean =>
  a.artworkId === b.artworkId &&
  a.variantId === b.variantId &&
  configKey(a.config) === configKey(b.config)

type ReserveResponse =
  | { ok: true; numberIds: string[]; reserved: number; expiresAt: number }
  | { ok: false; reason: 'sold_out' | 'not_found' | 'insufficient_stock'; available: number }

/**
 * Place a server-side cart hold on `quantity` numbers of a limited variant.
 * The server is the stock authority — on a sold-out / insufficient outcome
 * we THROW so the caller (wizard / stepper) can surface it and leave the cart
 * untouched. A network/transport failure throws too (the line must not be
 * added/grown without a confirmed hold).
 */
const reserveHold = async (
  variantId: string,
  quantity: number,
): Promise<{ numberIds: string[]; expiresAt: number }> => {
  const res = await fetch('/api/cart/reserve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variantId, quantity }),
  })

  if (!res.ok) {
    throw new Error('RESERVE_FAILED')
  }

  const data = (await res.json()) as ReserveResponse

  if (!data.ok) {
    if (data.reason === 'sold_out' || data.available === 0) {
      throw new Error('SOLD_OUT')
    }
    throw new Error(`ONLY ${data.available} LEFT`)
  }

  return { numberIds: data.numberIds, expiresAt: data.expiresAt }
}

/**
 * Release server-side cart holds (line removed, quantity lowered, etc.).
 * Fire-and-forget but awaited-safe: a transport failure is swallowed because
 * the server's TTL sweep is the backstop that frees abandoned holds.
 *
 * `expiresAt` (the value this client holds for the line) scopes the release to
 * MY hold: a number the TTL sweep already reclaimed and another buyer
 * re-reserved is left untouched server-side, so a stale tab can't steal it.
 */
const releaseHold = async (numberIds: string[], expiresAt?: number): Promise<void> => {
  if (numberIds.length === 0) return
  try {
    await fetch('/api/cart/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numberIds, expiresAt }),
    })
  } catch {
    // TTL sweep reclaims it — never block the UI on a release.
  }
}

/**
 * Refresh the server-side TTL for a line's cart holds so an engaged buyer's
 * cart doesn't expire under them. Returns the fresh server-owned `expiresAt`
 * (the client re-syncs its countdown to it), or `null` on any failure so the
 * caller leaves the existing expiry untouched. The server's guarded update
 * no-ops on rows that have advanced to checkout.
 */
const extendHold = async (numberIds: string[]): Promise<number | null> => {
  if (numberIds.length === 0) return null
  try {
    const res = await fetch('/api/cart/extend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numberIds }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { ok: boolean; expiresAt?: number }
    return typeof data.expiresAt === 'number' ? data.expiresAt : null
  } catch {
    return null
  }
}

type CartProviderProps = {
  children: ReactNode
}

export const CartProvider = ({ children }: CartProviderProps) => {
  const [items, setItems] = useState<CartItem[]>([])
  // Avoid clobbering localStorage before hydration has populated state.
  const hydrated = useRef(false)

  // Hydrate from localStorage on mount (client only).
  useEffect(() => {
    setItems(readStored())
    hydrated.current = true
  }, [])

  // Write through on every change, but only after initial hydration.
  useEffect(() => {
    if (!hydrated.current) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // localStorage may be unavailable (private mode / quota); ignore.
    }
  }, [items])

  const addItem = useCallback(async (item: AddItemInput) => {
    // Open editions are purely client-side — no server hold.
    if (item.editionType !== 'limited' || !item.variantId) {
      setItems((prev) => {
        const existingIndex = prev.findIndex((existing) => sameLine(existing, item))
        if (existingIndex !== -1) {
          const next = [...prev]
          const existing = next[existingIndex]
          next[existingIndex] = { ...existing, quantity: existing.quantity + item.quantity }
          return next
        }
        const { lineId, ...rest } = item
        const newLine: CartItem = { ...rest, lineId: lineId ?? crypto.randomUUID() }
        return [...prev, newLine]
      })
      return
    }

    // Limited edition: reserve BEFORE touching state. A failed reserve throws
    // (SOLD_OUT / ONLY N LEFT) and the cart is left exactly as it was.
    const { numberIds, expiresAt } = await reserveHold(item.variantId, item.quantity)

    setItems((prev) => {
      const existingIndex = prev.findIndex((existing) => sameLine(existing, item))
      if (existingIndex !== -1) {
        // Merge into the existing limited line: append the freshly held
        // numbers and bump quantity. The whole line shares one TTL window,
        // so the latest reserve's expiry governs.
        const next = [...prev]
        const existing = next[existingIndex]
        next[existingIndex] = {
          ...existing,
          quantity: existing.quantity + item.quantity,
          editionNumberIds: [...(existing.editionNumberIds ?? []), ...numberIds],
          holdExpiresAt: expiresAt,
        }
        return next
      }
      const { lineId, ...rest } = item
      const newLine: CartItem = {
        ...rest,
        lineId: lineId ?? crypto.randomUUID(),
        editionNumberIds: numberIds,
        holdExpiresAt: expiresAt,
      }
      return [...prev, newLine]
    })
  }, [])

  const removeItem = useCallback(
    async (lineId: string) => {
      const line = items.find((item) => item.lineId === lineId)
      if (line?.editionType === 'limited' && line.editionNumberIds?.length) {
        await releaseHold(line.editionNumberIds, line.holdExpiresAt)
      }
      setItems((prev) => prev.filter((item) => item.lineId !== lineId))
    },
    [items],
  )

  const setQuantity = useCallback(
    async (lineId: string, quantity: number): Promise<number> => {
      const next = Math.max(1, Math.floor(quantity))
      const line = items.find((item) => item.lineId === lineId)
      // Unknown line: report 0 so a caller never reads a misleading quantity.
      if (!line) return 0

      // Open editions: clamp in place, no server interaction.
      if (line.editionType !== 'limited' || !line.variantId) {
        if (next === line.quantity) return line.quantity
        setItems((prev) =>
          prev.map((item) => (item.lineId === lineId ? { ...item, quantity: next } : item)),
        )
        return next
      }

      const current = line.quantity
      if (next === current) return current

      if (next > current) {
        // Reserve the delta. On failure (sold out / not enough) keep the old
        // quantity — nothing changes and we report it unchanged so the caller
        // can detect the no-op without racing a re-render.
        const delta = next - current
        let held: { numberIds: string[]; expiresAt: number }
        try {
          held = await reserveHold(line.variantId, delta)
        } catch {
          return current
        }
        setItems((prev) =>
          prev.map((item) =>
            item.lineId === lineId
              ? {
                  ...item,
                  quantity: next,
                  editionNumberIds: [...(item.editionNumberIds ?? []), ...held.numberIds],
                  holdExpiresAt: held.expiresAt,
                }
              : item,
          ),
        )
        return next
      }

      // Decreasing: release the LAST `delta` held numbers and trim the list.
      const delta = current - next
      const ids = line.editionNumberIds ?? []
      const toRelease = ids.slice(ids.length - delta)
      const remaining = ids.slice(0, ids.length - delta)
      await releaseHold(toRelease, line.holdExpiresAt)
      setItems((prev) =>
        prev.map((item) =>
          item.lineId === lineId ? { ...item, quantity: next, editionNumberIds: remaining } : item,
        ),
      )
      return next
    },
    [items],
  )

  const clear = useCallback(async () => {
    // Release every limited line's cart holds before emptying, mirroring
    // removeItem — otherwise abandoning the cart strands reserved numbers as
    // falsely-unavailable to other buyers until the 15-min TTL sweep. This is
    // SAFE after a successful checkout too: releaseCartHolds is guarded to
    // free only rows that are still cart holds (no PI, no order item), so
    // checkout-bound numbers are a no-op, and the per-line holdExpiresAt scopes
    // the release to this client's own holds.
    for (const line of items) {
      if (line.editionType === 'limited' && line.editionNumberIds?.length) {
        await releaseHold(line.editionNumberIds, line.holdExpiresAt)
      }
    }
    setItems([])
  }, [items])

  const extendHolds = useCallback(async () => {
    // Refresh each limited line independently so a per-line re-sync of its
    // server-owned expiry can't bleed one line's TTL onto another.
    const updates = await Promise.all(
      items.map(async (line) => {
        if (line.editionType !== 'limited' || !line.editionNumberIds?.length) return null
        const expiresAt = await extendHold(line.editionNumberIds)
        return expiresAt === null ? null : { lineId: line.lineId, expiresAt }
      }),
    )
    const next = new Map<string, number>()
    for (const u of updates) {
      if (u !== null) next.set(u.lineId, u.expiresAt)
    }
    if (next.size === 0) return
    setItems((prev) =>
      prev.map((item) => {
        const expiresAt = next.get(item.lineId)
        return expiresAt === undefined ? item : { ...item, holdExpiresAt: expiresAt }
      }),
    )
  }, [items])

  const count = useMemo(() => cartCount(items), [items])

  const value = useMemo<CartContextValue>(
    () => ({ items, addItem, removeItem, setQuantity, clear, extendHolds, count }),
    [items, addItem, removeItem, setQuantity, clear, extendHolds, count],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = (): CartContextValue => {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return ctx
}
