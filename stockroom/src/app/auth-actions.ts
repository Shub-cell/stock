'use server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/supabase/server'

const str = (v: FormDataEntryValue | null, max = 200) => String(v ?? '').trim().slice(0, max)
const back = (to: string, key: string, msg: string): never => redirect(`${to}?${key}=${encodeURIComponent(msg)}`)

export async function login(fd: FormData) {
  const s = db()
  const { data, error } = await s.auth.signInWithPassword({ email: str(fd.get('email')), password: String(fd.get('password') ?? '').slice(0, 200) })
  if (error || !data.user) back('/login', 'err', 'Incorrect email or password.')
  const { data: p } = await s.from('profiles').select('active').eq('id', data.user!.id).single()
  if (!p?.active) { await s.auth.signOut(); back('/login', 'err', 'This account is deactivated.') }
  redirect('/')
}

export async function register(fd: FormData) {
  const password = String(fd.get('password') ?? '')
  const email = str(fd.get('email'))
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back('/register', 'err', 'Enter a valid email address.')
  if (password.length < 12 || password.length > 128) back('/register', 'err', 'Use a password of 12 to 128 characters.')
  const { error } = await db().auth.signUp({ email, password, options: { data: { full_name: str(fd.get('name'), 100) } } })
  if (error) back('/register', 'err', 'Registration failed. Try a different email or a stronger password.')
  back('/login', 'msg', 'Account created. Confirm your email if asked, then sign in.')
}

export async function logout() {
  await db().auth.signOut()
  redirect('/login')
}
