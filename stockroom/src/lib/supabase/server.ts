import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export function db() {
  const store = cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)) } catch { /* called from a server component */ }
      },
    },
  })
}

// The role is read from the database on every call; nothing from the browser is trusted.
export async function requireAdmin() {
  const s = db()
  const { data: { user } } = await s.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await s.from('profiles').select('role, active').eq('id', user.id).single()
  if (!p || !p.active || p.role !== 'admin') redirect('/')
  return { s, user }
}

export const imgUrl = (path?: string | null) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/inventory-images/${path}` : null
