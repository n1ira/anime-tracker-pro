import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { scanStateTable, showsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Define types for our cache
interface ScanStateResponse {
  id: number;
  isScanning: boolean | null;
  status: string | null;
  currentShowId: number | null;
  startedAt: Date | null;
  currentShow: {
    id: number;
    title: string;
  } | null;
}

// Cache the scan state for a short period to reduce database queries
let scanStateCache: {
  data: ScanStateResponse | null;
  timestamp: number;
  isScanning: boolean | null; // Track the scanning state separately
} = {
  data: null,
  timestamp: 0,
  isScanning: null
};

// Cache TTL in milliseconds (reduced from 500ms to 200ms)
const CACHE_TTL = 100; // Reduced from 200ms to 100ms

// Shorter TTL for when scan state changes
const CACHE_TTL_DURING_TRANSITION = 0; // No caching during transitions

// Track consecutive requests to dynamically adjust cache TTL
let consecutiveRequests = 0;
let lastRequestTime = 0;
const CONSECUTIVE_REQUEST_THRESHOLD = 10; // Increased from 5 to 10 - fewer requests will be considered "frequent"
const CONSECUTIVE_REQUEST_WINDOW = 2000; // Time window in ms to consider requests as consecutive

// Function to invalidate the cache
export function invalidateCache() {
  console.log('DEBUG: Invalidating scan state cache');
  scanStateCache.data = null;
  scanStateCache.timestamp = 0;
}

export async function GET() {
  try {
    const now = Date.now();
    
    // Track consecutive requests to dynamically adjust cache TTL
    if (now - lastRequestTime < CONSECUTIVE_REQUEST_WINDOW) {
      consecutiveRequests++;
      
      // If we're getting hammered with requests, extend the cache TTL
      // BUT ONLY if not currently scanning - always get fresh data during scans
      if (consecutiveRequests > CONSECUTIVE_REQUEST_THRESHOLD && 
          scanStateCache.data && 
          !scanStateCache.data.isScanning) {
        // Return cached data with extended TTL
        lastRequestTime = now;
        console.log('DEBUG: Using extended cache TTL due to frequent requests');
        return NextResponse.json(scanStateCache.data);
      }
    } else {
      // Reset consecutive requests counter if outside the window
      consecutiveRequests = 1;
    }
    
    lastRequestTime = now;
    
    // Determine which TTL to use based on whether we're in a transition
    // Always use zero TTL (no caching) if isScanning is true
    const effectiveTTL = scanStateCache.data && 
                         (scanStateCache.isScanning !== scanStateCache.data.isScanning ||
                          scanStateCache.data.isScanning === true)
                         ? CACHE_TTL_DURING_TRANSITION 
                         : CACHE_TTL;
    
    // Return cached data if it's still fresh
    if (scanStateCache.data && now - scanStateCache.timestamp < effectiveTTL) {
      console.log('DEBUG: Returning cached scan state, age:', now - scanStateCache.timestamp, 'ms, isScanning:', scanStateCache.data.isScanning);
      return NextResponse.json(scanStateCache.data);
    }
    
    console.log('DEBUG: Cache expired or not set, fetching fresh scan state from database');
    
    // Try to initialize scan state table if it doesn't exist
    try {
      // Check for existing scan state
      const existingScanState = await db.select({ count: sql`count(*)` }).from(scanStateTable);
      if (!existingScanState || existingScanState.length === 0 || existingScanState[0].count === 0) {
        console.log('DEBUG: No scan state found in status endpoint, initializing');
        await db.insert(scanStateTable).values({
          isScanning: false,
          status: 'idle',
          currentShowId: null
        });
        console.log('DEBUG: Successfully initialized scan state table from status endpoint');
      }
    } catch (initError) {
      console.error('WARNING: Error checking/initializing scan state table:', initError);
      // Continue processing and handle errors below if needed
    }
    
    // Get the current scan state with only the fields we need
    const scanState = await db.select({
      id: scanStateTable.id,
      isScanning: scanStateTable.isScanning,
      status: scanStateTable.status,
      currentShowId: scanStateTable.currentShowId,
      startedAt: scanStateTable.startedAt
    })
    .from(scanStateTable)
    .limit(1);
    
    if (!scanState || scanState.length === 0) {
      // Initialize scan state if it doesn't exist
      console.log('DEBUG: No scan state found, creating a new one');
      const newScanState = await db.insert(scanStateTable).values({
        isScanning: false,
        status: 'idle',
        currentShowId: null
      }).returning();
      
      if (!newScanState || newScanState.length === 0) {
        console.error('DEBUG: Failed to create new scan state');
        return NextResponse.json({ error: 'Failed to initialize scan state' }, { status: 500 });
      }
      
      const response: ScanStateResponse = {
        ...newScanState[0],
        currentShow: null,
      };
      
      // Update cache
      scanStateCache = {
        data: response,
        timestamp: now,
        isScanning: response.isScanning
      };
      
      console.log('DEBUG: Initialized new scan state:', JSON.stringify(response));
      return NextResponse.json(response);
    }
    
    // If there's a current show ID, get only the necessary show details
    let currentShow = null;
    if (scanState[0] && scanState[0].currentShowId) {
      const show = await db.select({
        id: showsTable.id,
        title: showsTable.title
      })
      .from(showsTable)
      .where(eq(showsTable.id, scanState[0].currentShowId))
      .limit(1);
      
      if (show && show.length > 0) {
        currentShow = show[0];
      }
    }
    
    const response: ScanStateResponse = {
      ...scanState[0],
      currentShow,
    };
    
    // Check if scan state has changed
    const scanStateChanged = scanStateCache.isScanning !== response.isScanning;
    
    // Update cache
    scanStateCache = {
      data: response,
      timestamp: now,
      isScanning: response.isScanning
    };
    
    // If scan state has changed, log it
    if (scanStateChanged) {
      console.log(`Scan state changed: isScanning = ${response.isScanning}, status = ${response.status}`);
      // Invalidate cache immediately to ensure fresh data on next request
      scanStateCache.timestamp = 0;
    }
    
    console.log('DEBUG: Returning fresh scan state, isScanning:', response.isScanning, 'status:', response.status);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching scan status:', error);
    
    // Return a default scan state in case of errors
    const defaultState: ScanStateResponse = {
      id: 1,
      isScanning: false,
      status: 'Error recovering',
      currentShowId: null,
      startedAt: null,
      currentShow: null
    };
    
    // Attempt to reset the scan state in the database
    try {
      await db.insert(scanStateTable).values({
        isScanning: false,
        status: 'Reset after error',
        currentShowId: null
      }).onConflictDoUpdate({
        target: scanStateTable.id,
        set: {
          isScanning: false,
          status: 'Reset after error',
          currentShowId: null
        }
      });
      
      console.log('DEBUG: Reset scan state after error');
    } catch (resetError) {
      console.error('Failed to reset scan state after error:', resetError);
    }
    
    // Invalidate cache to force a refresh next time
    invalidateCache();
    
    return NextResponse.json(defaultState, { status: 200 });
  }
} 