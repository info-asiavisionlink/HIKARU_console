import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/api/auth']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  const role = request.cookies.get('hk_cp_role')?.value
  const uid  = request.cookies.get('hk_cp_uid')?.value

  if (isPublicPath(pathname)) {
    if (uid && role === 'client' && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  if (pathname === '/') {
    if (!role || !uid) return NextResponse.redirect(new URL('/login', request.url))
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (!role || !uid) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (role !== 'client') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
