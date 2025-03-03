import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { scanStateTable, showsTable, episodesTable, logsTable } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

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
      
      await createLog(`Scan state initialized: ${status}`);
      return NextResponse.json(newScanState[0]);
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
    
    // Log the state change
    await createLog(`Scan state updated: ${status}`);
    
    // If starting a scan, initiate the scan process
    if (isScanning && action === 'start') {
      if (currentShowId) {
        // Scan a specific show
        await createLog(`Starting scan for show ID: ${currentShowId}`);
        scanShow(currentShowId, request.headers.get('origin') || '');
      } else {
        // Scan all shows
        await createLog('Starting scan for all shows');
        scanAllShows(request.headers.get('origin') || '');
      }
    } else if (!isScanning && action === 'stop') {
      await createLog('Scan stopped by user', 'warning');
    }
    
    return NextResponse.json(updatedState[0]);
  } catch (error) {
    console.error('Error updating scan state:', error);
    await createLog(`Error updating scan state: ${error}`, 'error');
    return NextResponse.json({ error: 'Failed to update scan state' }, { status: 500 });
  }
}

// Function to scan a specific show
async function scanShow(showId: number, origin: string) {
  try {
    // Log the start of the scan
    await createLog(`Starting scan for show ID: ${showId}`);
    
    // Get the show details
    const show = await db.select().from(showsTable).where(eq(showsTable.id, showId)).limit(1);
    
    if (show.length === 0) {
      await createLog(`Show with ID ${showId} not found`, 'error');
      
      // Update scan state to idle
      await db.update(scanStateTable)
        .set({
          isScanning: false,
          status: 'idle',
        })
        .where(eq(scanStateTable.id, 1));
      
      return;
    }
    
    await createLog(`Scanning show: ${show[0].title}`);
    
    // Get all episodes for this show
    const episodes = await db.select().from(episodesTable).where(eq(episodesTable.showId, showId));
    
    // Determine which episodes need to be downloaded
    const downloadedEpisodes = new Set(episodes.filter(ep => ep.isDownloaded).map(ep => ep.episodeNumber));
    const totalEpisodes = show[0].totalEpisodes || 0;
    
    // Log the scan details
    await createLog(`Scanning ${show[0].title}: ${downloadedEpisodes.size}/${totalEpisodes} episodes downloaded`);
    
    // Search for missing episodes
    for (let episode = 1; episode <= totalEpisodes; episode++) {
      if (downloadedEpisodes.has(episode)) {
        continue; // Skip already downloaded episodes
      }
      
      // Update scan state to show current episode
      await db.update(scanStateTable)
        .set({
          status: `Scanning ${show[0].title} - Episode ${episode}`,
        })
        .where(eq(scanStateTable.id, 1));
      
      // Log the episode scan
      await createLog(`Searching for ${show[0].title} - Episode ${episode}`);
      
      // Search for the episode using the torrent search API
      try {
        const response = await fetch(`${origin}/api/torrent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            showId,
            season: 1, // Default to season 1 for now
            episode,
          }),
        });
        
        const result = await response.json();
        
        if (result.success) {
          await createLog(`Found episode ${episode} of ${show[0].title}: ${result.title}`, 'success');
        } else {
          await createLog(`No match found for episode ${episode} of ${show[0].title}`, 'info');
        }
      } catch (error) {
        console.error(`Error searching for episode ${episode}:`, error);
        await createLog(`Error searching for episode ${episode} of ${show[0].title}`, 'error');
      }
      
      // Small delay to prevent overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Update the show's last scanned timestamp
    await db.update(showsTable)
      .set({
        lastScanned: new Date(),
      })
      .where(eq(showsTable.id, showId));
    
    // Update scan state to idle when done
    await db.update(scanStateTable)
      .set({
        isScanning: false,
        status: 'idle',
        currentShowId: null,
      })
      .where(eq(scanStateTable.id, 1));
    
    await createLog(`Scan completed for show: ${show[0].title}`);
  } catch (error) {
    console.error('Error scanning show:', error);
    await createLog(`Error scanning show: ${error}`, 'error');
    
    // Update scan state to error
    await db.update(scanStateTable)
      .set({
        isScanning: false,
        status: 'error',
      })
      .where(eq(scanStateTable.id, 1));
  }
}

// Function to scan all shows
async function scanAllShows(origin: string) {
  try {
    await createLog('Starting scan for all shows');
    
    // Get all shows
    const shows = await db.select().from(showsTable);
    
    if (shows.length === 0) {
      await createLog('No shows found to scan', 'warning');
      
      // Update scan state to idle
      await db.update(scanStateTable)
        .set({
          isScanning: false,
          status: 'idle',
        })
        .where(eq(scanStateTable.id, 1));
      
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
        break;
      }
      
      // Update current show ID
      await db.update(scanStateTable)
        .set({
          currentShowId: show.id,
          status: `Scanning show ${i + 1}/${shows.length}: ${show.title}`,
        })
        .where(eq(scanStateTable.id, 1));
      
      await createLog(`Scanning show ${i + 1}/${shows.length}: ${show.title}`);
      
      // Scan this show
      await scanShow(show.id, origin);
    }
    
    // Update scan state to idle when done
    await db.update(scanStateTable)
      .set({
        isScanning: false,
        status: 'idle',
        currentShowId: null,
      })
      .where(eq(scanStateTable.id, 1));
    
    await createLog('Scan completed for all shows');
  } catch (error) {
    console.error('Error scanning all shows:', error);
    await createLog(`Error scanning all shows: ${error}`, 'error');
    
    // Update scan state to error
    await db.update(scanStateTable)
      .set({
        isScanning: false,
        status: 'error',
      })
      .where(eq(scanStateTable.id, 1));
  }
} 