import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware runs on every request
export function middleware(request: NextRequest) {
  // Add request timeout handling if needed
  // Note: Next.js has built-in timeout handling, so we don't need to implement it manually

  // Add any other essential logic from the custom server here

  return NextResponse.next();
}

// Configure which paths this middleware is run on
export const config = {
  matcher: [
    // Apply to all paths
    '/(.*)',
    // Exclude static files and api routes if needed
    // '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
};
