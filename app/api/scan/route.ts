import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { scanStateTable, showsTable, episodesTable, logsTable } from '@/db/schema';
import { eq, and, isNull, lte } from 'drizzle-orm';
import { invalidateCache } from './status/route';
import { getSeasonAndEpisode } from '@/app/utils/episodeCalculator';
import { sql } from 'drizzle-orm';

// Helper function to create a log and return it
async function createLog(message: string, level: string = 'info') {
  // Skip repetitive "Direct match failed" and "Comparing episodes" logs for frontend display
  // These will still be logged to the console but not saved to the database
  const isRepetitiveLog = 
    (message.startsWith('Direct match failed:') || 
     message.startsWith('Comparing episodes for') ||
     message.startsWith('Parsed title'));
  
  console.log(`${level.toUpperCase()}: ${message}`);
  
  if (isRepetitiveLog) {
    return; // Skip saving repetitive logs to the database
  }
  
  try {
    await db.insert(logsTable).values({
      message,
      level,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error(`Error creating log: ${error}`);
  }
}

export async function GET() {
  try {
    // Try to initialize scan state table if it doesn't exist
    try {
      // Check for existing scan state
      const existingScanState = await db.select({ count: sql`count(*)` }).from(scanStateTable);
      if (!existingScanState || existingScanState.length === 0 || existingScanState[0].count === 0) {
        console.log('DEBUG: No scan state found in GET endpoint, initializing');
        await db.insert(scanStateTable).values({
          isScanning: false,
          status: 'idle',
          currentShowId: null
        });
        console.log('DEBUG: Successfully initialized scan state table from GET endpoint');
      }
    } catch (initError) {
      console.error('WARNING: Error checking/initializing scan state table in GET endpoint:', initError);
      // Continue processing and handle errors below if needed
    }
    
    const scanState = await db.select().from(scanStateTable).limit(1);
    
    if (!scanState || scanState.length === 0) {
      // Initialize scan state if it doesn't exist
      console.log('DEBUG: No scan state found even after initialization attempt, creating a new one');
      const newScanState = await db.insert(scanStateTable).values({
        isScanning: false,
        status: 'idle',
        currentShowId: null
      }).returning();
      
      return NextResponse.json(newScanState[0]);
    }
    
    return NextResponse.json(scanState[0]);
  } catch (error) {
    console.error('Error fetching scan state:', error);
    await createLog(`Error fetching scan state: ${error}`, 'error');
    
    // Return a default safe state in case of errors
    return NextResponse.json({
      id: 1,
      isScanning: false,
      status: 'Error recovering from database issue',
      currentShowId: null,
      startedAt: null
    }, { status: 200 }); // Return 200 to avoid cascading failures
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { isScanning, currentShowId, status, action } = body;
    const origin = request.headers.get('origin') || '';
    
    console.log('DEBUG: POST /api/scan received:', JSON.stringify(body));
    
    // Try to initialize scan state table if it doesn't exist
    try {
      // Check for existing scan state
      const existingScanState = await db.select({ count: sql`count(*)` }).from(scanStateTable);
      if (!existingScanState || existingScanState.length === 0 || existingScanState[0].count === 0) {
        console.log('DEBUG: No scan state found, attempting to initialize');
        await db.insert(scanStateTable).values({
          isScanning: false,
          status: 'idle',
          currentShowId: null
        });
        console.log('DEBUG: Successfully initialized scan state table');
      }
    } catch (initError) {
      console.error('WARNING: Error initializing scan state table:', initError);
      // Continue processing since the select below will handle missing state
    }
    
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
        // Get the current scan state to use its actual ID
        const currentStateData = await db.select().from(scanStateTable).limit(1);
        await db.update(scanStateTable)
          .set({
            isScanning: false,
            status: 'Scan completed',
            currentShowId: null,
          })
          .where(eq(scanStateTable.id, currentStateData[0].id));
          
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
        episodesPerSeasonArray = JSON.parse(episodesPerSeasonValue);
      }
      console.log(`DEBUG: Parsed episodesPerSeason: ${JSON.stringify(episodesPerSeasonArray)}`);
    } catch (error) {
      console.error(`Error parsing episodesPerSeason: ${error}`);
      episodesPerSeasonArray = Array(20).fill(12); // Default to 12 episodes per season
    }
    
    // Calculate absolute episode numbers
    const calculateAbsoluteEpisode = (season: number, episode: number): number => {
      let absoluteEpisode = episode;
      for (let s = 1; s < season; s++) {
        absoluteEpisode += episodesPerSeasonArray[s - 1] || 12; // Use default 12 if not specified
      }
      return absoluteEpisode;
    };
    
    // Calculate min and max episode range
    const minEpisode = calculateAbsoluteEpisode(show[0].startSeason || 1, show[0].startEpisode || 1);
    const maxEpisode = calculateAbsoluteEpisode(show[0].endSeason || 1, show[0].endEpisode || 12);
    
    // Filter downloaded episodes to only include those in our configured range
    const rangeDownloadedEpisodes = downloadedEpisodes.filter(ep => {
      return ep.episodeNumber >= minEpisode && ep.episodeNumber <= maxEpisode;
    });
    
    // Find highest downloaded episode in our range
    let highestDownloaded = minEpisode - 1; // Start with episode before our range
    for (const ep of rangeDownloadedEpisodes) {
      if (ep.episodeNumber > highestDownloaded) {
        highestDownloaded = ep.episodeNumber;
      }
    }
    
    // Calculate next episode to scan
    const nextEpisode = highestDownloaded + 1;
    if (nextEpisode > maxEpisode) {
      await createLog(`All configured episodes (${minEpisode}-${maxEpisode}) have been downloaded for ${show[0].title}`, 'success');
      
      // Update scan state to idle only if not part of a batch scan
      if (!isPartOfBatchScan) {
        // Get the current scan state to use its actual ID
        const currentStateData = await db.select().from(scanStateTable).limit(1);
        await db.update(scanStateTable)
          .set({
            isScanning: false,
            status: `Scan completed for ${truncateTitle(show[0].title)}`,
            currentShowId: null,
          })
          .where(eq(scanStateTable.id, currentStateData[0].id));
      }
      
      return true;
    }
    
    // Convert absolute episode back to season/episode format
    let targetSeason = 1;
    let targetEpisode = nextEpisode;
    
    for (let s = 1; s < 20; s++) { // Assume max 20 seasons
      const episodesInSeason = episodesPerSeasonArray[s - 1] || 12;
      if (targetEpisode > episodesInSeason) {
        targetEpisode -= episodesInSeason;
        targetSeason++;
      } else {
        break;
      }
    }
    
    // Add a clear summary of what we're scanning for and why
    const downloadedCount = rangeDownloadedEpisodes.length;
    const totalEpisodesInRange = maxEpisode - minEpisode + 1;
    const startSeason = show[0].startSeason || 1;
    const startEpisode = show[0].startEpisode || 1;
    const endSeason = show[0].endSeason || 1;
    const endEpisode = show[0].endEpisode || 12;
    
    await createLog(`Scanning ${show[0].title || 'Unknown Show'}: ${downloadedCount}/${totalEpisodesInRange} episodes downloaded in configured range (S${startSeason}E${startEpisode} to S${endSeason}E${endEpisode})`);
    await createLog(`Searching for ${show[0].title || 'Unknown Show'} - S${targetSeason}E${targetEpisode} (absolute #${nextEpisode})`);
    
    // Update scan state with current episode being scanned
    if (!isPartOfBatchScan) {
      const currentStateData = await db.select().from(scanStateTable).limit(1);
      await db.update(scanStateTable)
        .set({
          status: `Searching for ${truncateTitle(show[0].title || 'Unknown Show')} S${targetSeason}E${targetEpisode} (Absolute Episode ${nextEpisode})`,
        })
        .where(eq(scanStateTable.id, currentStateData[0].id));
    }
    
    // Let's start scanning from the next episode
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 1; // Changed from 3 to 1 to stop after first failure
    
    for (let absoluteEpisode = nextEpisode; absoluteEpisode <= maxEpisode; absoluteEpisode++) {
      // Check if scanning was stopped
      const currentState = await db.select().from(scanStateTable)
        .limit(1);
        
      if (!currentState[0].isScanning) {
        await createLog('Scan was stopped by user', 'warning');
        console.log('DEBUG: Scan was stopped by user during episode loop');
        return false;
      }
      
      // Check if this episode is already downloaded
      const isAlreadyDownloaded = downloadedEpisodes.some(ep => ep.episodeNumber === absoluteEpisode);
      if (isAlreadyDownloaded) {
        continue; // Skip already downloaded episodes
      }
      
      // Calculate season and episode number from absolute episode
      const { season, episode: episodeForSeason } = getSeasonAndEpisode(
        absoluteEpisode,
        show[0].title || 'Unknown Show',
        { [show[0].title || 'Unknown Show']: { episodes_per_season: episodesPerSeasonArray } }
      );
      
      // Update scan state with current search query
      if (!isPartOfBatchScan) {
        const currentStateData = await db.select().from(scanStateTable).limit(1);
        await db.update(scanStateTable)
          .set({
            status: `Searching for ${truncateTitle(show[0].title || 'Unknown Show')} - S${season}E${episodeForSeason} (absolute #${absoluteEpisode})`,
          })
          .where(eq(scanStateTable.id, currentStateData[0].id));
      }
      
      // Log the episode scan
      await createLog(`Searching for ${show[0].title || 'Unknown Show'} - S${season}E${episodeForSeason} (absolute #${absoluteEpisode})`);
      
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
          await createLog(`No results found for episode ${episodeForSeason} of ${show[0].title || 'Unknown Show'} (404)`, 'info');
          
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
          
          await createLog(`Found episode ${episodeForSeason} of ${show[0].title || 'Unknown Show'}: ${bestResult.title}`, 'success');
          
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
          await createLog(`No match found for episode ${episodeForSeason} of ${show[0].title || 'Unknown Show'}`, 'info');
          
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
        await createLog(`Error searching for episode ${episodeForSeason} of ${show[0].title || 'Unknown Show'}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        
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
      // Get the current scan state to use its actual ID
      const currentStateData = await db.select().from(scanStateTable).limit(1);
      await db.update(scanStateTable)
        .set({
          isScanning: false,
          status: `Scan completed for ${truncateTitle(show[0].title)}`,
          currentShowId: null,
        })
        .where(eq(scanStateTable.id, currentStateData[0].id));
        
      console.log(`DEBUG: Updated scan state after completing show scan:`, JSON.stringify(currentStateData[0]));
      
      // Explicitly invalidate the cache to ensure frontend gets fresh data
      invalidateCache();
    } else {
      console.log(`DEBUG: Not updating scan state as this is part of a batch scan`);
    }
    
    await createLog(`Scan completed for ${show[0].title || 'Unknown Show'}`, 'success');
    return true;
  } catch (error) {
    console.error('Error scanning show:', error);
    await createLog(`Error scanning show: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    
    // Update scan state to error only if not part of a batch scan
    if (!isPartOfBatchScan) {
      // Get the current scan state to use its actual ID
      const currentStateData = await db.select().from(scanStateTable).limit(1);
      const errorState = await db.update(scanStateTable)
        .set({
          isScanning: false,
          status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          currentShowId: null,
        })
        .where(eq(scanStateTable.id, currentStateData[0].id));
        
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
          status: `Scanning show ${i + 1}/${shows.length}: ${truncateTitle(show.title)}`,
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

// Helper function to truncate show titles for status messages
function truncateTitle(title: string, maxLength: number = 20): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
} 