import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLoggedIn = !!request.cookies.get('session'); // ou ton token

  // Si non connecté et qu'il tente d'accéder au dashboard → /login
  if (!isLoggedIn && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si connecté et qu'il va sur /login → /
  if (isLoggedIn && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: ['/', '/users', '/settings'],
};
