
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const s = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),

        setAll: (list) => {
          list.forEach(({ name, value }) => {
            req.cookies.set(name, value)
          })

          res = NextResponse.next({ request: req })

          list.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const pathname = req.nextUrl.pathname
  const open = ['/login', '/register'].includes(pathname)

  const authStart = performance.now()
  const {
    data: { user },
    error,
  } = await s.auth.getUser()

  console.log(
    '[MIDDLEWARE] Auth duration:',
    (performance.now() - authStart).toFixed(2),
    'ms'
  )

  if (error || !user) {
    if (open) return res

    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
