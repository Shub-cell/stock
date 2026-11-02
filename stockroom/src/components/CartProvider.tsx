'use client'

import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

type CartItem = { id: string; name: string; quantity: number; image_path: string | null; cartQuantity: number }
type CartContextValue = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'cartQuantity'>) => void
  setItemQuantity: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
  ready: boolean
}
const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'stockroom-cart-v1'

export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used inside CartProvider')
  return value
}

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setItems(parsed.filter((x): x is CartItem => x && typeof x.id === 'string' && typeof x.name === 'string' && Number.isInteger(x.quantity) && x.quantity >= 0 && Number.isInteger(x.cartQuantity) && x.cartQuantity > 0).slice(0, 100))
        }
      }
    } catch { /* Ignore malformed local cart data. */ }
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, ready])

  const addItem = useCallback((item: Omit<CartItem, 'cartQuantity'>) => {
    if (item.quantity < 1) return
    setItems(current => {
      const existing = current.find(x => x.id === item.id)
      if (existing) return current.map(x => x.id === item.id ? { ...x, name: item.name, quantity: item.quantity, image_path: item.image_path, cartQuantity: Math.min(x.cartQuantity + 1, item.quantity) } : x)
      return [...current, { ...item, cartQuantity: 1 }]
    })
  }, [])

  const setItemQuantity = useCallback((id: string, quantity: number) => {
    setItems(current => current.flatMap(x => x.id !== id ? [x] : quantity < 1 ? [] : [{ ...x, cartQuantity: Math.min(Math.floor(quantity), x.quantity) }]))
  }, [])
  const removeItem = useCallback((id: string) => setItems(current => current.filter(x => x.id !== id)), [])
  const clearCart = useCallback(() => setItems([]), [])
  const value = useMemo(() => ({ items, addItem, setItemQuantity, removeItem, clearCart, ready }), [items, addItem, setItemQuantity, removeItem, clearCart, ready])
  const showCart = ready && items.length > 0 && pathname !== '/cart'

  return (
    <CartContext.Provider value={value}>
      {children}
      {showCart && (
        <Link href="/cart" aria-label="Open cart" title="Open cart" className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-2 ring-white transition hover:scale-105 hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </Link>
      )}
    </CartContext.Provider>
  )
}
