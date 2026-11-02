'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (m: string): never => redirect('/admin?err=' + encodeURIComponent(m))
const done = (): never => { revalidatePath('/', 'layout'); return redirect('/admin') }

const text = (fd: FormData, k: string, max: number) => {
  const v = String(fd.get(k) ?? '').trim()
  if (!v || v.length > max) fail(`Enter a name of 1 to ${max} characters.`)
  return v
}
const uuid = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '')
  return UUID.test(v) ? v : fail('Invalid request.')
}
const qty = (fd: FormData) => {
  const n = Number(fd.get('quantity'))
  return Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : fail('Quantity must be a whole number from 0 to 1,000,000.')
}

// Decide the file type from its bytes, never from the filename or browser-supplied MIME type.
function sniff(b: Uint8Array): [string, string] | null {
  const at = (i: number, s: number[]) => s.every((v, k) => b[i + k] === v)
  if (at(0, [0xff, 0xd8, 0xff])) return ['jpg', 'image/jpeg']
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ['png', 'image/png']
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return ['webp', 'image/webp']
  return null
}
async function upload(s: SupabaseClient, f: FormDataEntryValue | null): Promise<string | null> {
  if (!(f instanceof File) || f.size === 0) return null
  if (f.size > 2_000_000) fail('Image must be smaller than 2 MB.')
  const bytes = new Uint8Array(await f.arrayBuffer())
  const t = sniff(bytes)
  if (!t) return fail('Only JPEG, PNG or WebP images are allowed.')
  const path = `${crypto.randomUUID()}.${t[0]}`
  const { error } = await s.storage.from('inventory-images').upload(path, bytes, { contentType: t[1], upsert: false })
  if (error) fail('The image could not be uploaded.')
  return path
}

export async function addCategory(fd: FormData) {
  const { s } = await requireAdmin()
  const name = text(fd, 'name', 60)
  const image_path = await upload(s, fd.get('image'))
  const { error } = await s.from('categories').insert({ name, image_path })
  if (error) fail('Could not add the category. The name may already exist.')
  done()
}

export async function deleteCategory(fd: FormData) {
  const { s } = await requireAdmin()
  const { error } = await s.from('categories').delete().eq('id', uuid(fd, 'id'))
  if (error) fail('This category still contains items. Move or delete them first.')
  done()
}

export async function addItem(fd: FormData) {
  const { s } = await requireAdmin()
  const row = { name: text(fd, 'name', 100), category_id: uuid(fd, 'category_id'), quantity: qty(fd), image_path: await upload(s, fd.get('image')) }
  const { error } = await s.from('items').insert(row)
  if (error) fail('Could not add the item.')
  done()
}

export async function setQuantity(fd: FormData) {
  const { s } = await requireAdmin()
  const { error } = await s.from('items').update({ quantity: qty(fd) }).eq('id', uuid(fd, 'id'))
  if (error) fail('Could not update the quantity.')
  done()
}

export async function deleteItem(fd: FormData) {
  const { s } = await requireAdmin()
  const { error } = await s.from('items').delete().eq('id', uuid(fd, 'id'))
  if (error) fail('Could not delete the item.')
  done()
}
