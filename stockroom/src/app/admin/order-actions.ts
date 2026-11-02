'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/supabase/server'

const validId = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
function result(message: string): never { redirect('/admin?order_msg=' + encodeURIComponent(message)) }

export async function approveOrder(fd: FormData) {
  const { s } = await requireAdmin()
  const id = String(fd.get('id') ?? '')
  if (!validId(id)) result('Invalid order request.')
  const { error } = await s.rpc('approve_inventory_order', { p_order_id: id })
  if (error) {
    const msg = error.message.toLowerCase().includes('insufficient stock') ? 'Cannot approve: one or more items no longer have enough stock. Update stock or reject this request.' : error.message.toLowerCase().includes('already reviewed') ? 'This order has already been reviewed.' : 'Could not approve the order request.'
    result(msg)
  }
  revalidatePath('/admin'); revalidatePath('/orders'); revalidatePath('/', 'layout')
  result('Order approved and inventory updated.')
}

export async function rejectOrder(fd: FormData) {
  const { s } = await requireAdmin()
  const id = String(fd.get('id') ?? '')
  if (!validId(id)) result('Invalid order request.')
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 300)
  const { error } = await s.rpc('reject_inventory_order', { p_order_id: id, p_reason: reason || null })
  if (error) result('Could not reject the order request. It may already have been reviewed.')
  revalidatePath('/admin'); revalidatePath('/orders')
  result('Order request rejected. Inventory was not changed.')
}
