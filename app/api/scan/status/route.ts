import { NextResponse } from 'next/server';
import { getScanState } from '@/app/services/scanService';
import { logInfo } from '@/app/utils/logging';
import { successResponse, withErrorHandling } from '@/app/utils/api/responseHandler';

// Cache for scan state
let scanStateCache: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 2000; // 2 seconds

// Track last log time to reduce log spam
let lastLogTimestamp: number = 0;
const LOG_INTERVAL = 5000; // Only log once every 5 seconds

/**
 * Invalidates the scan state cache
 */
export function invalidateCache() {
  scanStateCache = null;
  cacheTimestamp = 0;
}

/**
 * GET endpoint to get the current scan state
 */
export async function GET() {
  return withErrorHandling(async () => {
    // Check if we have a valid cache
    const now = Date.now();
    if (scanStateCache && now - cacheTimestamp < CACHE_TTL) {
      return successResponse(scanStateCache, 'Scan state retrieved from cache');
    }

    // Only log periodically to reduce log spam
    if (now - lastLogTimestamp > LOG_INTERVAL) {
      await logInfo('GET /api/scan/status - Getting scan state');
      lastLogTimestamp = now;
    }

    // Get the current scan state
    const scanState = await getScanState();

    // Update cache
    scanStateCache = scanState;
    cacheTimestamp = now;

    return successResponse(scanState, 'Scan state retrieved successfully');
  }, 'Failed to get scan state');
}

/**
 * DELETE endpoint to invalidate the scan state cache
 */
export async function DELETE() {
  return withErrorHandling(async () => {
    await logInfo('DELETE /api/scan/status - Invalidating scan state cache');

    invalidateCache();

    return successResponse({ cacheInvalidated: true }, 'Scan state cache invalidated');
  }, 'Failed to invalidate scan state cache');
}
