
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/supabase/server'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (m: string): never =>
  redirect('/admin?err=' + encodeURIComponent(m))

const done = (): never => {
  revalidatePath('/', 'layout')
  return redirect('/admin')
}

const text = (fd: FormData, k: string, max: number) => {
  const v = String(fd.get(k) ?? '').trim()

  if (!v || v.length > max) {
    return fail(`Enter a name of 1 to ${max} characters.`)
  }

  return v
}

const uuid = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '')
  return UUID.test(v) ? v : fail('Invalid request.')
}

const qty = (fd: FormData) => {
  const n = Number(fd.get('quantity'))

  return Number.isInteger(n) && n >= 0 && n <= 1_000_000
    ? n
    : fail('Quantity must be a whole number from 0 to 1,000,000.')
}

// Identify the image format from its bytes.
function sniff(b: Uint8Array): [string, string] | null {
  const at = (i: number, s: number[]) =>
    s.every((v, k) => b[i + k] === v)

  if (at(0, [0xff, 0xd8, 0xff])) {
    return ['jpg', 'image/jpeg']
  }

  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return ['png', 'image/png']
  }

  if (
    at(0, [0x52, 0x49, 0x46, 0x46]) &&
    at(8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return ['webp', 'image/webp']
  }

  return null
}

async function upload(
  s: SupabaseClient,
  f: FormDataEntryValue | null
): Promise<string | null> {
  if (!(f instanceof File) || f.size === 0) {
    return null
  }

  if (f.size > 2_000_000) {
    return fail('Image must be smaller than 2 MB.')
  }

  const bytes = new Uint8Array(await f.arrayBuffer())
  const t = sniff(bytes)

  if (t === null) {
    return fail('Only JPEG, PNG or WebP images are allowed.')
  }

  const path = `${crypto.randomUUID()}.${t[0]}`

  const { error } = await s.storage
    .from('inventory-images')
    .upload(path, bytes, {
      contentType: t[1],
      upsert: false,
    })

  if (error) {
    return fail('The image could not be uploaded.')
  }

  return path
}

export async function addCategory(fd: FormData) {
  const { s } = await requireAdmin()
  const name = text(fd, 'name', 60)
  const image_path = await upload(s, fd.get('image'))

  const { error } = await s
    .from('categories')
    .insert({ name, image_path })

  if (error) {
    return fail('Could not add the category. The name may already exist.')
  }

  done()
}

export async function deleteCategory(fd: FormData) {
  const { s } = await requireAdmin()
  const categoryId = uuid(fd, 'id')

  // Find items belonging to this category.
  const { data: fetchedItems, error: itemsError } = await s
    .from('items')
    .select('id')
    .eq('category_id', categoryId)

  if (itemsError) {
    console.error('Fetch category items error:', itemsError)
    return fail('Could not check the category items.')
  }

  if (fetchedItems === null) {
    return fail('Could not check the category items.')
  }

  const items = fetchedItems

  // Create/find the archive category only when items need processing.
  let archivedCategoryId: string | null = null

  if (items.length > 0) {
    const { data: archivedCategory, error: categoryError } = await s
      .from('categories')
      .upsert(
        { name: 'Archived Items' },
        { onConflict: 'name' }
      )
      .select('id')
      .single()

    if (categoryError) {
      console.error('Archive category error:', categoryError)
      return fail('Could not prepare the archive category.')
    }

    if (archivedCategory === null) {
      return fail('Could not prepare the archive category.')
    }

    archivedCategoryId = archivedCategory.id
  }

  for (const item of items) {
    // Check whether the item appears in order history.
    const { count, error: historyError } = await s
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('item_id', item.id)

    if (historyError) {
      console.error('Check item history error:', historyError)
      return fail('Could not check item order history.')
    }

    if ((count ?? 0) > 0) {
      // Preserve order references and hide the historical item.
      if (archivedCategoryId === null) {
        return fail('Could not find the archive category.')
      }

      const { error } = await s
        .from('items')
        .update({
          category_id: archivedCategoryId,
          is_active: false,
        })
        .eq('id', item.id)

      if (error) {
        console.error('Preserve historical item error:', error)
        return fail('Could not preserve an item from order history.')
      }
    } else {
      // Permanently delete items with no order history.
      const { error } = await s
        .from('items')
        .delete()
        .eq('id', item.id)

      if (error) {
        console.error('Delete item error:', error)
        return fail('Could not delete an item in this category.')
      }
    }
  }

  // Delete the original category after processing its items.
  const { error: deleteError } = await s
    .from('categories')
    .delete()
    .eq('id', categoryId)

  if (deleteError) {
    console.error('Delete category error:', deleteError)
    return fail('Could not delete the category.')
  }

  done()
}

export async function addItem(fd: FormData) {
  const { s } = await requireAdmin()

  const row = {
    name: text(fd, 'name', 100),
    category_id: uuid(fd, 'category_id'),
    quantity: qty(fd),
    image_path: await upload(s, fd.get('image')),
  }

  const { error } = await s.from('items').insert(row)

  if (error) {
    return fail('Could not add the item.')
  }

  done()
}

export async function setQuantity(fd: FormData) {
  const { s } = await requireAdmin()

  const { error } = await s
    .from('items')
    .update({ quantity: qty(fd) })
    .eq('id', uuid(fd, 'id'))

  if (error) {
    return fail('Could not update the quantity.')
  }

  done()
}

export async function deleteItem(fd: FormData) {
  const { s } = await requireAdmin()
  const itemId = uuid(fd, 'id')

  // Check whether this item appears in order history.
  const { count, error: checkError } = await s
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', itemId)

  if (checkError) {
    console.error('Check order history error:', checkError)
    return fail('Could not check item order history.')
  }

  if ((count ?? 0) > 0) {
    // Preserve historical orders by archiving the item.
    const { error } = await s
      .from('items')
      .update({ is_active: false })
      .eq('id', itemId)

    if (error) {
      console.error('Archive item error:', error)
      return fail('Could not archive item.')
    }
  } else {
    // Permanently delete items without order history.
    const { error } = await s
      .from('items')
      .delete()
      .eq('id', itemId)

    if (error) {
      console.error('Delete item error:', error)
      return fail('Could not delete item.')
    }
  }

  done()
}
