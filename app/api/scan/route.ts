import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { scanStateTable, showsTable, episodesTable, logsTable } from '@/db/schema';
import { eq, and, isNull, lte } from 'drizzle-orm';
import { invalidateCache } from './status/route';
import { getSeasonAndEpisode } from '@/app/utils/episodeCalculator';

// Helper function to create a log and return it
async function createLog(message: string, level: string = 'info') {
  const newLog = await db.insert(logsTable).values({
    message,
    level,
    createdAt: new Date(),
  }).returning();
  
  // Make a POST request to the logs API to trigger SSE
  try {
    // Use direct database operations instead of fetch for server-to-server communication
    // This avoids the URL parsing issues
    // The logs will still be sent to SSE clients through the logs POST endpoint
    // when external clients call it
    return newLog[0];
  } catch (error) {
    console.error('Error sending log to SSE:', error);
  }
  
  return newLog[0];
}

export async function GET() {
  try {
    const scanState = await db.select().from(scanStateTable).limit(1);
    
    if (scanState.length === 0) {
      // Initialize scan state if it doesn't exist
      const newScanState = await db.insert(scanStateTable).values({
        isScanning: false,
        status: 'idle',
      }).returning();
      
      return NextResponse.json(newScanState[0]);
    }
    
    return NextResponse.json(scanState[0]);
  } catch (error) {
    console.error('Error fetching scan state:', error);
    await createLog(`Error fetching scan state: ${error}`, 'error');
    return NextResponse.json({ error: 'Failed to fetch scan state' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { isScanning, currentShowId, status, action } = body;
    const origin = request.headers.get('origin') || '';
    
    console.log('DEBUG: POST /api/scan received:', JSON.stringify(body));
    
    // Get the current scan state
    const currentState = await db.select().from(scanStateTable).limit(1);
    
    if (currentState.length === 0) {
      // Initialize scan state if it doesn't exist
      const newScanState = await db.insert(scanStateTable).values({
        isScanning,
        currentShowId,
        status,
        startedAt: isScanning ? new Date() : null,
      }).returning();
      
      console.log('DEBUG: Initialized new scan state:', JSON.stringify(newScanState[0]));
      await createLog(`Scan state initialized: ${status}`);
      return NextResponse.json(newScanState[0]);
    }
    
    // If stopping a scan, immediately update the state to stop scanning
    if (action === 'stop') {
      const stoppedState = await db.update(scanStateTable)
        .set({
          isScanning: false,
          status: 'Scan stopped by user',
          currentShowId: null,
        })
        .where(eq(scanStateTable.id, currentState[0].id))
        .returning();
      
      console.log('DEBUG: Stopped scan:', JSON.stringify(stoppedState[0]));
      await createLog('Scan stopped by user', 'warning');
      return NextResponse.json(stoppedState[0]);
    }
    
    // Update existing scan state
    const updatedState = await db.update(scanStateTable)
      .set({
        isScanning,
        currentShowId,
        status,
        startedAt: isScanning && !currentState[0].isScanning ? new Date() : currentState[0].startedAt,
      })
      .where(eq(scanStateTable.id, currentState[0].id))
      .returning();
    
    console.log('DEBUG: Updated scan state:', JSON.stringify(updatedState[0]));
    
    // Log the state change
    await createLog(`Scan state updated: ${status}`);
    
    // If starting a scan, initiate the scan process
    if (isScanning && action === 'start') {
      if (currentShowId) {
        // Scan a specific show
        await createLog(`Starting scan for show ID: ${currentShowId}`);
        console.log('DEBUG: Starting scan for specific show:', currentShowId);
        // Use a non-blocking call to scanShow
        setTimeout(() => {
          scanShow(currentShowId, origin)
            .catch(err => console.error('Error in scanShow:', err));
        }, 0);
      } else {
        // Scan all shows
        await createLog('Starting scan for all shows');
        console.log('DEBUG: Starting scan for all shows');
        // Use a non-blocking call to scanAllShows
        setTimeout(() => {
          scanAllShows(origin)
            .catch(err => console.error('Error in scanAllShows:', err));
        }, 0);
      }
    }
    
    return NextResponse.json(updatedState[0]);
  } catch (error) {
    console.error('Error updating scan state:', error);
    await createLog(`Error updating scan state: ${error}`, 'error');
    return NextResponse.json({ error: 'Failed to update scan state' }, { status: 500 });
  }
}

// Function to scan a specific show
async function scanShow(showId: number, origin: string, isPartOfBatchScan: boolean = false) {
  try {
    // Log the start of the scan
    await createLog(`Starting scan for show ID: ${showId}`);
    console.log(`DEBUG: scanShow started for show ID: ${showId}, isPartOfBatchScan: ${isPartOfBatchScan}`);
    
    // Get the show details
    const show = await db.select().from(showsTable).where(eq(showsTable.id, showId)).limit(1);
    
    if (show.length === 0) {
      await createLog(`Show with ID ${showId} not found`, 'error');
      
      // Update scan state to idle only if not part of a batch scan
      if (!isPartOfBatchScan) {
        await db.update(scanStateTable)
          .set({
            isScanning: false,
            status: 'idle',
          })
          .where(eq(scanStateTable.id, 1));
          
        console.log(`DEBUG: Show with ID ${showId} not found, updated scan state to idle`);
      }
      
      return false;
    }
    
    await createLog(`Scanning show: ${show[0].title}`);
    
    // Get all episodes for this show
    const allEpisodes = await db.select()
      .from(episodesTable)
      .where(eq(episodesTable.showId, showId))
      .orderBy(episodesTable.episodeNumber);
    
    // Create a Set of downloaded episode numbers for efficient lookups
    const downloadedEpisodeSet = new Set(
      allEpisodes
        .filter(ep => ep.isDownloaded)
        .map(ep => ep.episodeNumber)
    );
    
    // Parse episodesPerSeason
    let episodesPerSeason: number | number[] = 12;
    if (show[0].episodesPerSeason) {
      try {
        const parsed = JSON.parse(show[0].episodesPerSeason);
        if (Array.isArray(parsed)) {
          episodesPerSeason = parsed;
        } else {
          episodesPerSeason = parseInt(show[0].episodesPerSeason, 10) || 12;
        }
      } catch (e) {
        episodesPerSeason = parseInt(show[0].episodesPerSeason, 10) || 12;
      }
    }
    
    // Helper function to calculate absolute episode number
    const calculateAbsoluteEpisode = (season: number, episode: number): number => {
      if (Array.isArray(episodesPerSeason)) {
        let absoluteEpisode = 0;
        for (let s = 1; s < season; s++) {
          const seasonEps = s <= episodesPerSeason.length 
            ? episodesPerSeason[s - 1] 
            : (episodesPerSeason[episodesPerSeason.length - 1] || 12);
          absoluteEpisode += seasonEps;
        }
        return absoluteEpisode + episode;
      } else {
        return (season - 1) * episodesPerSeason + episode;
      }
    };
    
    // Get show range
    const startSeason = show[0].startSeason || 1;
    const startEpisode = show[0].startEpisode || 1;
    const endSeason = show[0].endSeason || 1;
    const endEpisode = show[0].endEpisode || 12;
    
    // Calculate min and max absolute episode numbers for the range
    const minEpisode = calculateAbsoluteEpisode(startSeason, startEpisode);
    const maxEpisode = calculateAbsoluteEpisode(endSeason, endEpisode);
    
    console.log(`DEBUG: Show range is S${startSeason}E${startEpisode} to S${endSeason}E${endEpisode}`);
    console.log(`DEBUG: Absolute episode range: ${minEpisode} to ${maxEpisode}`);
    
    // Get episodes in our range
    const episodesInRange = allEpisodes.filter(ep => 
      ep.episodeNumber >= minEpisode && ep.episodeNumber <= maxEpisode
    );
    
    // Count downloaded episodes in range
    const downloadedCount = episodesInRange.filter(ep => ep.isDownloaded).length;
    
    // Find the highest downloaded episode number
    let highestDownloaded = 0;
    for (const episode of episodesInRange) {
      if (episode.isDownloaded && episode.episodeNumber > highestDownloaded) {
        highestDownloaded = episode.episodeNumber;
      }
    }
    
    // Log the scan details
    await createLog(`Scanning ${show[0].title}: ${downloadedCount}/${episodesInRange.length} episodes downloaded, current episode is ${highestDownloaded}`);
    
    // Search for the next episode after the highest downloaded one
    let nextEpisodeToScan = highestDownloaded + 1;
    
    // If we've reached the max episode in our range, we're done
    if (nextEpisodeToScan > maxEpisode) {
      await createLog(`All episodes in range have been scanned for ${show[0].title}`, 'success');
      
      // Mark scan complete
      await db.update(scanStateTable)
        .set({
          isScanning: isPartOfBatchScan, // Keep scanning if part of batch
          status: `Scan completed for ${show[0].title}`,
        })
        .where(eq(scanStateTable.id, 1));
      
      // Update the show's last scanned timestamp
      await db.update(showsTable)
        .set({
          lastScanned: new Date(),
        })
        .where(eq(showsTable.id, showId));
      
      await createLog(`Scan completed for ${show[0].title}`, 'success');
      return true;
    }
    
    // Let's start scanning from the next episode
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 1; // Changed from 3 to 1 to stop after first failure
    
    for (let absoluteEpisode = nextEpisodeToScan; absoluteEpisode <= maxEpisode; absoluteEpisode++) {
      // Check if scanning was stopped
      const currentState = await db.select().from(scanStateTable)
        .limit(1);
        
      if (!currentState[0].isScanning) {
        await createLog('Scan was stopped by user', 'warning');
        console.log('DEBUG: Scan was stopped by user during episode loop');
        return false;
      }
      
      if (downloadedEpisodeSet.has(absoluteEpisode)) {
        continue; // Skip already downloaded episodes
      }
      
      // Calculate season and episode number from absolute episode
      const { season, episode: episodeForSeason } = getSeasonAndEpisode(
        absoluteEpisode,
        show[0].title,
        { [show[0].title]: { episodes_per_season: episodesPerSeason } }
      );
      
      // Update scan state to show current episode
      await db.update(scanStateTable)
        .set({
          status: `Searching for ${show[0].title} - S${season}E${episodeForSeason} (absolute #${absoluteEpisode})`,
        })
        .where(eq(scanStateTable.id, currentState[0].id));
      
      // Log the episode scan
      await createLog(`Searching for ${show[0].title} - S${season}E${episodeForSeason} (absolute #${absoluteEpisode})`);
      
      // Search for the episode using the torrent search API
      try {
        // Set a timeout for the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(`${origin}/api/torrent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            showId,
            season,
            episode: episodeForSeason
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Handle 404 as a normal "no results found" case rather than an error
        if (response.status === 404) {
          await createLog(`No results found for episode ${episodeForSeason} of ${show[0].title} (404)`, 'info');
          
          // Increment consecutive failures counter
          consecutiveFailures++;
          
          // Stop scanning if we've had too many consecutive failures
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            await createLog(`Stopping scan after ${MAX_CONSECUTIVE_FAILURES} consecutive failures - no new episodes found`, 'warning');
            console.log(`DEBUG: Stopping scan after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`);
            break;
          }
          
          // Continue to next episode
          continue;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.results && result.results.length > 0) {
          // Get the best result (first one)
          const bestResult = result.results[0];
          
          await createLog(`Found episode ${episodeForSeason} of ${show[0].title}: ${bestResult.title}`, 'success');
          
          // Log the episode match info - simplified for frontend
          console.log(`DEBUG: Episode match details - API matched absolute episode ${episodeForSeason} with parsed title: ${JSON.stringify(bestResult)}`);
          
          // Mark the episode as downloaded
          await db.update(episodesTable)
            .set({ 
              isDownloaded: true,
              magnetLink: bestResult.magnetLink
            })
            .where(and(
              eq(episodesTable.showId, showId),
              eq(episodesTable.episodeNumber, absoluteEpisode)
            ));
            
          // Log the success
          await createLog(`Marked S${season}E${episodeForSeason} (absolute #${absoluteEpisode}) as downloaded`, 'success');
          
          // Reset consecutive failures counter on success
          consecutiveFailures = 0;
        } else {
          await createLog(`No match found for episode ${episodeForSeason} of ${show[0].title}`, 'info');
          
          // Increment consecutive failures counter
          consecutiveFailures++;
          
          // Stop scanning if we've had too many consecutive failures
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            await createLog(`Stopping scan after ${MAX_CONSECUTIVE_FAILURES} consecutive failures - no new episodes found`, 'warning');
            console.log(`DEBUG: Stopping scan after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`);
            break;
          }
        }
      } catch (error) {
        console.error(`Error searching for episode ${episodeForSeason}:`, error);
        await createLog(`Error searching for episode ${episodeForSeason} of ${show[0].title}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        
        // Increment consecutive failures counter
        consecutiveFailures++;
        
        // Stop scanning if we've had too many consecutive failures
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          await createLog(`Stopping scan after ${MAX_CONSECUTIVE_FAILURES} consecutive failures - no new episodes found`, 'warning');
          console.log(`DEBUG: Stopping scan after ${MAX_CONSECUTIVE_FAILURES} consecutive failures due to error`);
          break;
        }
      }
      
      // Small delay to prevent overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Update the show's last scanned timestamp
    await db.update(showsTable)
      .set({
        lastScanned: new Date(),
      })
      .where(eq(showsTable.id, showId));
    
    // Update scan state to idle only if not part of a batch scan
    if (!isPartOfBatchScan) {
      const currentStateData = await db.select().from(scanStateTable).limit(1);
      const updatedState = await db.update(scanStateTable)
        .set({
          isScanning: false,
          status: 'idle',
          currentShowId: null,
        })
        .where(eq(scanStateTable.id, currentStateData[0].id))
        .returning();
        
      console.log(`DEBUG: Updated scan state after completing show scan:`, JSON.stringify(updatedState[0]));
      
      // Explicitly invalidate the cache to ensure frontend gets fresh data
      invalidateCache();
    } else {
      console.log(`DEBUG: Not updating scan state as this is part of a batch scan`);
    }
    
    await createLog(`Scan completed for ${show[0].title}`, 'success');
    return true;
  } catch (error) {
    console.error('Error scanning show:', error);
    await createLog(`Error scanning show: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    
    // Update scan state to error only if not part of a batch scan
    if (!isPartOfBatchScan) {
      const currentStateData = await db.select().from(scanStateTable).limit(1);
      const errorState = await db.update(scanStateTable)
        .set({
          isScanning: false,
          status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          currentShowId: null,
        })
        .where(eq(scanStateTable.id, currentStateData[0].id))
        .returning();
        
      console.log(`DEBUG: Updated scan state after error:`, JSON.stringify(errorState[0]));
      
      // Explicitly invalidate the cache to ensure frontend gets fresh data
      invalidateCache();
    } else {
      console.log(`DEBUG: Not updating scan state after error as this is part of a batch scan`);
    }
    
    return false;
  }
}

// Function to scan all shows
async function scanAllShows(origin: string) {
  try {
    await createLog('Starting scan for all shows');
    console.log('DEBUG: Starting scanAllShows function');
    
    // Get all shows
    const shows = await db.select().from(showsTable);
    
    if (shows.length === 0) {
      await createLog('No shows found to scan', 'warning');
      
      // Update scan state to idle
      const currentStateData = await db.select().from(scanStateTable).limit(1);
      await db.update(scanStateTable)
        .set({
          isScanning: false,
          status: 'idle',
          currentShowId: null,
        })
        .where(eq(scanStateTable.id, currentStateData[0].id));
      
      console.log('DEBUG: No shows found, updated scan state to idle');
      return;
    }
    
    await createLog(`Found ${shows.length} shows to scan`);
    
    // Scan each show sequentially
    for (let i = 0; i < shows.length; i++) {
      const show = shows[i];
      
      // Check if scanning was stopped
      const currentState = await db.select().from(scanStateTable).limit(1);
      if (!currentState[0].isScanning) {
        await createLog('Scanning was stopped by user', 'warning');
        console.log('DEBUG: Scanning was stopped by user during show loop');
        break;
      }
      
      // Update current show ID
      await db.update(scanStateTable)
        .set({
          currentShowId: show.id,
          status: `Scanning show ${i + 1}/${shows.length}: ${show.title}`,
        })
        .where(eq(scanStateTable.id, currentState[0].id));
      
      await createLog(`Scanning show ${i + 1}/${shows.length}: ${show.title}`);
      
      // Scan this show
      await scanShow(show.id, origin, true);
      
      // Verify scan state after each show scan
      const scanStateAfterShow = await db.select().from(scanStateTable).limit(1);
      
      // If scan was manually stopped, break the loop
      if (!scanStateAfterShow[0].isScanning) {
        await createLog('Scan was manually stopped, ending scan process', 'warning');
        console.log('DEBUG: Scan was manually stopped after scanning a show');
        break;
      }
    }
  } catch (error) {
    console.error('Error scanning all shows:', error);
    await createLog(`Error scanning all shows: ${error}`, 'error');
    
    // Update scan state to error
    const currentStateData = await db.select().from(scanStateTable).limit(1);
    const errorState = await db.update(scanStateTable)
      .set({
        isScanning: false,
        status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        currentShowId: null,
      })
      .where(eq(scanStateTable.id, currentStateData[0].id))
      .returning();
    
    console.log('DEBUG: Updated scan state after error:', JSON.stringify(errorState[0]));
    
    // Explicitly invalidate the cache to ensure frontend gets fresh data
    invalidateCache();
  } finally {
    // Always update the scan state when the batch scan completes
    // This is the critical part - we need to ensure the scan state is updated
    // regardless of how we got here (success, failure, etc.)
    
    // Final check to ensure scan state is properly updated
    const finalState = await db.select().from(scanStateTable).limit(1);
    console.log('DEBUG: Final state before update:', JSON.stringify(finalState[0]));
    
    // Only update if still scanning (not already stopped by user)
    if (finalState[0].isScanning) {
      const updatedState = await db.update(scanStateTable)
        .set({
          isScanning: false,
          status: 'Scan completed',
          currentShowId: null,
        })
        .where(eq(scanStateTable.id, finalState[0].id))  // Use the actual ID from the state
        .returning();
      
      console.log('DEBUG: Updated scan state after completion:', JSON.stringify(updatedState[0]));
      await createLog('Scan completed for all shows', 'success');
      
      // Explicitly invalidate the cache to ensure frontend gets fresh data
      invalidateCache();
    } else {
      console.log('DEBUG: Scan was already stopped, not updating state');
    }
    
    // Double-check that the scan state is properly updated
    const finalCheckState = await db.select().from(scanStateTable).limit(1);
    console.log('DEBUG: Final check state in finally block:', JSON.stringify(finalCheckState[0]));
    
    if (finalCheckState[0].isScanning) {
      const resetState = await db.update(scanStateTable)
        .set({
          isScanning: false,
          status: 'Scan process ended',
          currentShowId: null,
        })
        .where(eq(scanStateTable.id, finalCheckState[0].id))  // Use the actual ID from the state
        .returning();
      
      console.log('DEBUG: Reset scan state in finally block:', JSON.stringify(resetState[0]));
      await createLog('Ensuring scan state is properly reset', 'info');
      
      // Explicitly invalidate the cache to ensure frontend gets fresh data
      invalidateCache();
    }
    
    console.log('DEBUG: scanAllShows function completed');
  }
} 