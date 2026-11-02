import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })
  const s = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({ request: req })
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await s.auth.getUser() // validated against Supabase Auth, not just decoded
  const open = ['/login', '/register'].includes(req.nextUrl.pathname)
  if (!user && !open) return NextResponse.redirect(new URL('/login', req.url))
  return res
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
