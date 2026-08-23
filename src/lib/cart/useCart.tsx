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
  /** Returns the quantity actually achieved. Always the requested value now
   *  that nothing is reserved client-side; kept as the source of truth for
   *  callers rather than a ref read in the await-continuation. */
  setQuantity: (lineId: string, quantity: number) => Promise<number>
  clear: () => Promise<void>
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

  // Nothing is reserved when a line is added. The cart is a list of intents;
  // stock is settled once, atomically, when payment starts — see
  // createCartPaymentIntent. Holding numbers in the cart bought only a
  // fifteen-minute promise and cost a countdown, a heartbeat, expiry handling
  // and a cart that emptied itself behind the buyer's back.
  const addItem = useCallback(async (item: AddItemInput) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((existing) => sameLine(existing, item))
      if (existingIndex !== -1) {
        const next = [...prev]
        const existing = next[existingIndex]
        next[existingIndex] = { ...existing, quantity: existing.quantity + item.quantity }
        return next
      }
      const { lineId, ...rest } = item
      return [...prev, { ...rest, lineId: lineId ?? crypto.randomUUID() }]
    })
  }, [])

  const removeItem = useCallback(async (lineId: string) => {
    setItems((prev) => prev.filter((item) => item.lineId !== lineId))
  }, [])

  const setQuantity = useCallback(async (lineId: string, quantity: number): Promise<number> => {
    const next = Math.max(1, Math.floor(quantity))
    setItems((prev) =>
      prev.map((item) => (item.lineId === lineId ? { ...item, quantity: next } : item)),
    )
    return next
  }, [])

  const clear = useCallback(async () => {
    setItems([])
  }, [])

  const count = useMemo(() => cartCount(items), [items])

  const value = useMemo<CartContextValue>(
    () => ({ items, addItem, removeItem, setQuantity, clear, count }),
    [items, addItem, removeItem, setQuantity, clear, count],
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
