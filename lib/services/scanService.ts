import { db } from '@/db/db';
import { scanStateTable, showsTable, episodesTable } from '@/db/schema';
import { eq, and, isNull, lte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { createLog, logDebug, logInfo, logWarning, logError } from '@/app/utils/logging';
import { getSeasonAndEpisode } from '@/app/utils/episodeCalculator';
import { truncateTitle } from '@/app/utils/titleParser';

/**
 * Initialize the scan state table if it doesn't exist
 */
export async function initializeScanState(): Promise<void> {
  try {
    // Check for existing scan state
    const existingScanState = await db.select({ count: sql`count(*)` }).from(scanStateTable);
    if (!existingScanState || existingScanState.length === 0 || existingScanState[0].count === 0) {
      logDebug('No scan state found, initializing');
      await db.insert(scanStateTable).values({
        isScanning: false,
        status: 'idle',
        currentShowId: null
      });
      logDebug('Successfully initialized scan state table');
    }
  } catch (error) {
    console.error('WARNING: Error checking/initializing scan state table:', error);
  }
}

/**
 * Get the current scan state
 * @returns The current scan state or null if not found
 */
export async function getScanState() {
  await initializeScanState();
  
  const scanState = await db.select().from(scanStateTable).limit(1);
  return scanState.length > 0 ? scanState[0] : null;
}

/**
 * Update the scan state
 * @param updates The fields to update
 * @returns The updated scan state
 */
export async function updateScanState(updates: {
  isScanning?: boolean;
  status?: string;
  currentShowId?: number | null;
}) {
  const currentState = await getScanState();
  
  if (!currentState) {
    // Initialize scan state if it doesn't exist
    const newScanState = await db.insert(scanStateTable).values({
      isScanning: updates.isScanning ?? false,
      status: updates.status ?? 'idle',
      currentShowId: updates.currentShowId ?? null,
      startedAt: updates.isScanning ? new Date() : null,
    }).returning();
    
    logDebug(`Initialized new scan state: ${JSON.stringify(newScanState[0])}`);
    return newScanState[0];
  }
  
  // Update existing scan state
  const updatedState = await db.update(scanStateTable)
    .set({
      ...updates,
      startedAt: updates.isScanning === true ? new Date() : currentState.startedAt,
    })
    .where(eq(scanStateTable.id, currentState.id))
    .returning();
  
  logDebug(`Updated scan state: ${JSON.stringify(updatedState[0])}`);
  return updatedState[0];
}

/**
 * Stop the current scan
 * @param reason The reason for stopping
 * @returns The updated scan state
 */
export async function stopScan(reason: string = 'Scan stopped by user'): Promise<any> {
  return updateScanState({
    isScanning: false,
    status: reason,
    currentShowId: null,
  });
}

/**
 * Scan a single show
 * @param showId The ID of the show to scan
 * @param origin The origin of the request
 * @param isPartOfBatchScan Whether this scan is part of a batch scan
 * @returns True if the scan was successful, false otherwise
 */
export async function scanShow(showId: number, origin: string, isPartOfBatchScan: boolean = false): Promise<boolean> {
  try {
    // Log the start of the scan
    await createLog(`Starting scan for show ID: ${showId}`);
    logDebug(`scanShow started for show ID: ${showId}, isPartOfBatchScan: ${isPartOfBatchScan}`);
    
    // Get the show details
    const show = await db.select().from(showsTable).where(eq(showsTable.id, showId)).limit(1);
    
    if (show.length === 0) {
      await createLog(`Show with ID ${showId} not found`, 'error');
      
      // Update scan state to idle only if not part of a batch scan
      if (!isPartOfBatchScan) {
        await stopScan(`Show with ID ${showId} not found`);
      }
      
      return false;
    }
    
    await createLog(`Scanning show: ${show[0].title}`);
    
    // Get all episodes for this show
    const allEpisodes = await db.select()
      .from(episodesTable)
      .where(eq(episodesTable.showId, showId))
      .orderBy(episodesTable.episodeNumber);
      
    // Get downloaded episodes
    const downloadedEpisodes = allEpisodes.filter(ep => ep.isDownloaded);
    
    // Parse episodes per season configuration
    let episodesPerSeasonArray: number[];
    try {
      const episodesPerSeasonValue = show[0].episodesPerSeason;
      // Check if it's a single number or a JSON array
      if (!episodesPerSeasonValue) {
        // Handle null or undefined case
        episodesPerSeasonArray = Array(20).fill(12); // Default to 12 episodes per season
      } else if (!isNaN(Number(episodesPerSeasonValue))) {
        episodesPerSeasonArray = Array(20).fill(Number(episodesPerSeasonValue)); // Assume max 20 seasons
      } else {
        // Try to parse as JSON array
        try {
          const parsed = JSON.parse(episodesPerSeasonValue);
          if (Array.isArray(parsed)) {
            episodesPerSeasonArray = parsed;
          } else {
            episodesPerSeasonArray = Array(20).fill(12); // Default to 12 episodes per season
          }
        } catch (e) {
          // If parsing fails, default to 12 episodes per season
          episodesPerSeasonArray = Array(20).fill(12);
        }
      }
    } catch (error) {
      logError(`Error parsing episodesPerSeason for show ${show[0].title}`, error);
      episodesPerSeasonArray = Array(20).fill(12); // Default to 12 episodes per season
    }
    
    // Update the show's last scanned timestamp
    await db.update(showsTable)
      .set({ lastScanned: new Date() })
      .where(eq(showsTable.id, showId));
    
    // Update scan state to completed if not part of a batch scan
    if (!isPartOfBatchScan) {
      await updateScanState({
        isScanning: false,
        status: 'Scan completed',
        currentShowId: null,
      });
    }
    
    await createLog(`Scan completed for show: ${show[0].title}`);
    return true;
  } catch (error) {
    logError(`Error scanning show ${showId}`, error);
    
    // Update scan state to error if not part of a batch scan
    if (!isPartOfBatchScan) {
      await updateScanState({
        isScanning: false,
        status: 'Scan error',
        currentShowId: null,
      });
    }
    
    return false;
  }
}

/**
 * Scan all shows
 * @param origin The origin of the request
 * @returns Promise that resolves when all shows have been scanned
 */
export async function scanAllShows(origin: string): Promise<void> {
  try {
    await createLog('Starting scan for all shows');
    logDebug('Starting scanAllShows function');
    
    // Get all shows
    const shows = await db.select().from(showsTable);
    
    if (shows.length === 0) {
      await createLog('No shows found to scan', 'warning');
      
      // Update scan state to idle
      await updateScanState({
        isScanning: false,
        status: 'idle',
        currentShowId: null,
      });
      
      logDebug('No shows found, updated scan state to idle');
      return;
    }
    
    await createLog(`Found ${shows.length} shows to scan`);
    
    // Scan each show sequentially
    for (let i = 0; i < shows.length; i++) {
      const show = shows[i];
      
      // Check if scanning was stopped
      const currentState = await getScanState();
      if (!currentState?.isScanning) {
        await createLog('Scanning was stopped by user', 'warning');
        logDebug('Scanning was stopped by user during show loop');
        break;
      }
      
      // Update current show ID
      await updateScanState({
        currentShowId: show.id,
        status: `Scanning show ${i + 1}/${shows.length}: ${truncateTitle(show.title)}`,
      });
      
      await createLog(`Scanning show ${i + 1}/${shows.length}: ${show.title}`);
      
      // Scan this show
      await scanShow(show.id, origin, true);
    }
    
    // Update scan state to completed
    await updateScanState({
      isScanning: false,
      status: 'All shows scanned',
      currentShowId: null,
    });
    
    await createLog('All shows scanned');
  } catch (error) {
    logError('Error scanning all shows', error);
    
    // Update scan state to error
    await updateScanState({
      isScanning: false,
      status: 'Scan error',
      currentShowId: null,
    });
  }
} 