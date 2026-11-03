
import './globals.css'
import Link from 'next/link'
import type { Metadata } from 'next'
import { db } from '@/lib/supabase/server'
import { logout } from './auth-actions'
import CartProvider from '@/components/CartProvider'

export const metadata: Metadata = {
  title: 'Stockroom',
  description: 'Inventory management',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const s = db()

  const authStart = performance.now()

  const {
    data: { user },
    error: authError,
  } = await s.auth.getUser()

  console.log(
    '[LAYOUT] Supabase auth duration:',
    (performance.now() - authStart).toFixed(2),
    'ms',
    'Auth error:',
    !!authError
  )

  const profileStart = performance.now()

  const { data: p, error: profileError } = user
    ? await s
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
    : { data: null, error: null }

  console.log(
    '[LAYOUT] Profile query duration:',
    (performance.now() - profileStart).toFixed(2),
    'ms',
    'Profile error:',
    !!profileError
  )

  return (
    <html lang="en">
      <body>
        <header className="border-b border-rule bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1d4e5f"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" />
                <path d="M3 8l9 5 9-5M12 13v8" />
              </svg>
              Stockroom
            </Link>

            {user && (
              <form
                action="/"
                className="order-last w-full sm:order-none sm:w-72"
              >
                <input
                  name="q"
                  className="field"
                  placeholder="Search all items"
                  aria-label="Search all items"
                  maxLength={60}
                />
              </form>
            )}

            <nav className="ml-auto flex items-center gap-4 text-sm">
              {user && (
                <Link
                  href="/orders"
                  prefetch={false}
                  className="hover:underline"
                >
                  My orders
                </Link>
              )}

              {p?.role === 'admin' && (
                <Link href="/admin" className="hover:underline">
                  Manage inventory
                </Link>
              )}

              {user ? (
                <form action={logout} className="flex items-center gap-3">
                  <span className="hidden text-ink/60 sm:inline">
                    {p?.full_name || 'Account'}
                  </span>
                  <button className="btn-quiet">Sign out</button>
                </form>
              ) : (
                <Link href="/login" className="btn-quiet">
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>

        <CartProvider>
          <main className="mx-auto max-w-5xl px-4 py-8">
            {children}
          </main>
        </CartProvider>
      </body>
    </html>
  )
}
