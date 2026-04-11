import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/register', '/forgot-password'];

const protectedPrefixes = [
  '/dashboard',
  '/select-hospital',
  '/select-module',
  '/super-admin',
  '/subscription-expired',
  '/manage-subscription',
  '/my-account',
  '/staff-forms',
  '/hospital',
  '/laboratory',
  '/radiology',
  '/pharmacy',
  '/ot',
  '/counsellor',
  '/daycare',
  '/ward',
  '/doctor',
  '/my-hospitals',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('accessToken')?.value;

  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // Authenticated user on public auth path → send to hospital selection
  if (isPublicPath && accessToken) {
    return NextResponse.redirect(new URL('/select-hospital', request.url));
  }

  // Unauthenticated user on protected path → send to login
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && !accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/select-hospital',
    '/select-module',
    '/super-admin/:path*',
    '/hospital/:path*',
    '/laboratory/:path*',
    '/radiology/:path*',
    '/pharmacy/:path*',
    '/ot/:path*',
    '/counsellor/:path*',
    '/daycare/:path*',
    '/ward/:path*',
    '/doctor/:path*',
    '/my-hospitals',
    '/subscription-expired',
    '/manage-subscription',
    '/my-account',
    '/staff-forms',
    '/login',
    '/register',
    '/forgot-password',
  ],
};
