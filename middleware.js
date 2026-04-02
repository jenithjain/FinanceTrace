import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow static assets to pass through unchanged.
  const isStaticAsset =
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/models/') ||
    pathname.startsWith('/fonts/') ||
    /\.[a-zA-Z0-9]+$/.test(pathname);

  if (isStaticAsset) {
    return NextResponse.next();
  }

  // Never intercept API routes. API handlers already enforce auth and must return JSON.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  });

  const isRootRoute = pathname === '/';
  const isLoginRoute = pathname === '/login' || pathname === '/auth';
  const role = token?.role || 'viewer';

  // Public routes
  const isPublicRoute = isRootRoute || isLoginRoute;

  // If user is not authenticated and trying to access protected route
  if (!token && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user tries to access login/auth, redirect to dashboard
  if (token && isLoginRoute) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Admin-only route protection
  if (pathname.startsWith('/dashboard/users')) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    if (role !== 'admin') {
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Analyst/Admin-only route protection
  if (pathname.startsWith('/dashboard/transactions') || pathname.startsWith('/assistant')) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    if (!['analyst', 'admin'].includes(role)) {
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
