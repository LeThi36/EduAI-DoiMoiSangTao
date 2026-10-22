import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  SESSION_COOKIE,
  verifySessionToken,
  refreshSessionToken,
  sessionCookieOptions,
} from '@/lib/auth/session'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 1. Verify signed custom session cookie (signature + idle/absolute expiry)
  const rawSession = request.cookies.get(SESSION_COOKIE)?.value
  const session = await verifySessionToken(rawSession)
  const hasCustomSession = Boolean(session)
  const sessionExpired = Boolean(rawSession) && !session

  // 2. Check Supabase Auth
  let hasSupabaseUser = false
  const hasValidSupabase =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('paste_anon_key')

  if (hasValidSupabase) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
              )
            },
          },
        }
      )

      const { data: { user } } = await supabase.auth.getUser()
      hasSupabaseUser = Boolean(user)
    } catch { }
  }

  const isAuthenticated = hasCustomSession || hasSupabaseUser

  // Attach cookie changes (refresh or clear) to any response we return
  const finalize = async (res: NextResponse) => {
    if (session) {
      const refreshed = await refreshSessionToken(session)
      if (refreshed) {
        res.cookies.set(SESSION_COOKIE, refreshed, sessionCookieOptions)
      }
    } else if (sessionExpired) {
      res.cookies.delete(SESSION_COOKIE)
    }
    return res
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/forgot-password', '/auth/callback']
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  // API routes: block expired sessions (except auth endpoints and dev testing in Bruno)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const isDevTest =
      process.env.NODE_ENV !== 'production' &&
      (request.headers.get('x-dev-test') === '1' ||
        request.headers.get('user-agent')?.toLowerCase().includes('bruno'))
    const isAuthApi = request.nextUrl.pathname.startsWith('/api/auth/')
    if (!isAuthApi && !isAuthenticated && !isDevTest) {
      return finalize(
        NextResponse.json({ error: 'Phiên đăng nhập đã hết hạn' }, { status: 401 })
      )
    }
    return finalize(supabaseResponse)
  }

  // Redirect unauthenticated users to login
  if (!isAuthenticated && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (sessionExpired) url.searchParams.set('expired', '1')
    return finalize(NextResponse.redirect(url))
  }

  // Redirect authenticated users away from login
  if (isAuthenticated && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.search = ''
    url.pathname = session?.role === 'student' ? '/student/dashboard' : '/dashboard'
    return finalize(NextResponse.redirect(url))
  }

  return finalize(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
