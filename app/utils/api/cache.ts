import { NextResponse } from 'next/server';

// Cache durations in seconds
export const CACHE_DURATIONS = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
};

/**
 * Creates a cached API response with appropriate headers
 * @param data - The data to return in the response
 * @param status - HTTP status code (default: 200)
 * @param cacheDuration - Cache duration in seconds (default: no caching)
 * @returns NextResponse with cache headers
 */
export function createCachedResponse(
  data: any,
  status = 200,
  cacheDuration?: number
) {
  const response = NextResponse.json(
    { success: true, data },
    { status }
  );

  if (cacheDuration) {
    // Set cache control headers
    response.headers.set(
      'Cache-Control',
      `public, s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`
    );
  } else {
    // Set no-cache for dynamic data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

/**
 * Creates an error response with appropriate headers
 * @param message - Error message
 * @param status - HTTP status code (default: 500)
 * @returns NextResponse with no-cache headers
 */
export function createErrorResponse(message: string, status = 500) {
  const response = NextResponse.json(
    { success: false, error: message },
    { status }
  );

  // Error responses should never be cached
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
} 