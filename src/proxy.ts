import { auth } from '@/auth'
import { NextResponse } from 'next/server'

// Role hierarchy constants
const ADMIN_ROLES = ['admin', 'superAdmin'] as const

export default auth((request) => {
  const { auth: session, nextUrl } = request

  // Protect admin routes - require admin or superAdmin role
  if (nextUrl.pathname.startsWith('/admin')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/', nextUrl.origin))
    }
    if (!ADMIN_ROLES.includes(session.user.userType as (typeof ADMIN_ROLES)[number])) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl.origin))
    }
  }

  // Protect dashboard routes - require authentication (except login page)
  if (nextUrl.pathname.startsWith('/dashboard') && nextUrl.pathname !== '/dashboard/login') {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/dashboard/login', nextUrl.origin))
    }
  }

  // Protect exhibition edit routes - require authentication
  // Real route: /exhibitions/:artistSlug/:exhibitionSlug/edit
  const editRouteMatch = nextUrl.pathname.match(/^\/exhibitions\/[^/]+\/[^/]+\/edit$/)
  if (editRouteMatch) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/', nextUrl.origin))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/exhibitions/:artistSlug/:exhibitionSlug/edit'],
}
