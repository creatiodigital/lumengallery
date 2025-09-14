'use client'

import type { Store } from '@reduxjs/toolkit'
import { useRef, type ReactNode } from 'react'
import { Provider } from 'react-redux'

import { makeStore } from '@/redux/store'

type StoreProviderProps = {
  children: ReactNode
}

export default function StoreProvider({ children }: StoreProviderProps) {
  const storeRef = useRef<Store | null>(null)
  if (!storeRef.current) {
    storeRef.current = makeStore()
  }

  return <Provider store={storeRef.current}>{children}</Provider>
}
