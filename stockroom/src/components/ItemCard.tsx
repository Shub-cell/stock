'use client'
import { useState } from 'react'
import { useCart } from '@/components/CartProvider'

export default function ItemCard({ item }: { item: { id: string; name: string; quantity: number; image_path: string | null } }) {
  const src = item.image_path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/inventory-images/${item.image_path}` : null
  const { addItem, items } = useCart()
  const [added, setAdded] = useState(false)
  const inCart = items.find(x => x.id === item.id)?.cartQuantity ?? 0
  return (
    <div className="w-[160px] rounded-lg border border-rule bg-white p-2 shadow-sm">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded bg-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt={item.name} loading="lazy" className="h-full w-full object-cover" /> : <span className="text-xs text-ink/40">No image</span>}
      </div>
      <p className="mt-2 truncate text-sm font-medium" title={item.name}>{item.name}</p>
      <p className={`text-xs ${item.quantity < 5 ? 'font-medium text-warn' : 'text-ink/60'}`}>Available: {item.quantity}</p>
      <button type="button" disabled={item.quantity < 1 || inCart >= item.quantity} onClick={() => { addItem(item); setAdded(true); window.setTimeout(() => setAdded(false), 1400) }} className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1 rounded bg-brand px-2 text-xs font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-gray-300">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        {item.quantity < 1 ? 'Out of stock' : inCart >= item.quantity ? 'Stock limit reached' : added ? 'Added!' : 'Add to cart'}
      </button>
    </div>
  )
}
