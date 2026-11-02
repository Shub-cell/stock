'use server'

import { db } from '@/lib/supabase/server'

type RequestedItem = { id: string; quantity: number }
type SubmitResult = { ok: boolean; message: string; orderId?: string }

export async function submitOrder(items: RequestedItem[]): Promise<SubmitResult> {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) return { ok: false, message: 'Your cart is empty or contains too many different items.' }
  const seen = new Set<string>()
  const clean: RequestedItem[] = []
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000_000 || seen.has(item.id)) {
      return { ok: false, message: 'One or more cart items are invalid. Please review your cart.' }
    }
    seen.add(item.id)
    clean.push({ id: item.id, quantity: item.quantity })
  }
  const s = db()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return { ok: false, message: 'Please sign in before submitting an order.' }
  const { data: profile } = await s.from('profiles').select('active').eq('id', user.id).single()
  if (!profile?.active) return { ok: false, message: 'Your account is not active.' }
  const { data, error } = await s.rpc('submit_inventory_order', { p_items: clean })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('insufficient stock')) return { ok: false, message: 'One or more items no longer have enough stock. Update your cart and try again.' }
    if (msg.includes('not found')) return { ok: false, message: 'An item in your cart is no longer available. Please review your cart.' }
    return { ok: false, message: 'We could not submit your order. Please try again or contact the administrator.' }
  }
  return { ok: true, message: 'Order request submitted. It is now waiting for admin approval.', orderId: data as string }
}
