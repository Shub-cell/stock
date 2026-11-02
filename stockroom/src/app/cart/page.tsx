'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useCart } from '@/components/CartProvider'
import { submitOrder } from './actions'

const imageUrl = (path: string | null) => path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/inventory-images/${path}` : null

export default function CartPage() {
  const { items, setItemQuantity, removeItem, clearCart, ready } = useCart()
  const [message, setMessage] = useState('')
  const [submittedOrder, setSubmittedOrder] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    setMessage('')
    startTransition(async () => {
      const result = await submitOrder(items.map(i => ({ id: i.id, quantity: i.cartQuantity })))
      setMessage(result.message)
      if (result.ok) {
        setSubmittedOrder(result.orderId ?? '')
        clearCart()
      }
    })
  }

  if (!ready) return <section><h1 className="text-xl font-semibold">Your cart</h1><p className="mt-4 text-sm text-ink/60">Loading your cart…</p></section>

  if (submittedOrder) return <section className="mx-auto max-w-xl panel p-6 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-700">✓</div><h1 className="mt-4 text-xl font-semibold">Order request submitted</h1><p className="mt-2 text-sm text-ink/70">Your request has been sent to the administrator. Inventory will only be reduced if the order is approved.</p><p className="mt-3 break-all text-xs text-ink/50">Order reference: {submittedOrder}</p><div className="mt-5 flex justify-center gap-3"><Link href="/orders" className="btn">View my orders</Link><Link href="/" className="btn-quiet">Continue browsing</Link></div></section>

  return (
    <section className="mx-auto max-w-3xl">
      <Link href="/" className="text-sm text-brand hover:underline">← Continue browsing</Link>
      <h1 className="mb-5 mt-2 text-xl font-semibold">Your cart</h1>
      {message && <p role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>}
      {!items.length ? <div className="panel p-8 text-center"><p className="font-medium">Your cart is empty</p><p className="mt-1 text-sm text-ink/60">Open a category and add items to your cart.</p><Link href="/" className="btn mt-4">Browse categories</Link></div> : <>
        <div className="space-y-3">
          {items.map(item => {
            const src = imageUrl(item.image_path)
            return <div key={item.id} className="panel flex items-center gap-3 p-3 sm:gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-paper">{/* eslint-disable-next-line @next/next/no-img-element */}{src ? <img src={src} alt={item.name} className="h-full w-full object-cover" /> : <span className="text-[10px] text-ink/40">No image</span>}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-ink/60">Available stock: {item.quantity}</p></div>
              <div className="flex items-center gap-2"><button type="button" onClick={() => setItemQuantity(item.id, item.cartQuantity - 1)} className="h-8 w-8 rounded border border-rule" aria-label={`Decrease ${item.name} quantity`}>−</button><span className="w-5 text-center text-sm">{item.cartQuantity}</span><button type="button" disabled={item.cartQuantity >= item.quantity} onClick={() => setItemQuantity(item.id, item.cartQuantity + 1)} className="h-8 w-8 rounded border border-rule disabled:opacity-40" aria-label={`Increase ${item.name} quantity`}>+</button></div>
              <button type="button" onClick={() => removeItem(item.id)} className="ml-1 text-xs text-red-700 hover:underline">Remove</button>
            </div>
          })}
        </div>
        <div className="mt-5 rounded-lg border border-rule bg-white p-4"><p className="text-sm text-ink/70">Submitting this cart sends an order request to the administrator. Your inventory is <strong>not</strong> reduced unless the administrator approves it.</p><button type="button" disabled={pending || !items.length} onClick={submit} className="btn mt-4 w-full sm:w-auto">{pending ? 'Submitting request…' : 'Submit order request'}</button></div>
      </>}
    </section>
  )
}
