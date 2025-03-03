import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { scanStateTable, showsTable, episodesTable, logsTable } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

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
    
    // If starting a scan, initiate the scan process
    if (isScanning && action === 'start') {
      if (currentShowId) {
        // Scan a specific show
        await scanShow(currentShowId, request.headers.get('origin') || '');
      } else {
        // Scan all shows
        await scanAllShows(request.headers.get('origin') || '');
      }
    }
    
    return NextResponse.json(updatedState[0]);
  } catch (error) {
    console.error('Error updating scan state:', error);
    return NextResponse.json({ error: 'Failed to update scan state' }, { status: 500 });
  }
}

// Function to scan a specific show
async function scanShow(showId: number, origin: string) {
  try {
    // Log the start of the scan
    await db.insert(logsTable).values({
      message: `Starting scan for show ID: ${showId}`,
      level: 'info',
      createdAt: new Date(),
    });
    
    // Get the show details
    const show = await db.select().from(showsTable).where(eq(showsTable.id, showId)).limit(1);
    
    if (show.length === 0) {
      await db.insert(logsTable).values({
        message: `Show with ID ${showId} not found`,
        level: 'error',
        createdAt: new Date(),
      });
      return;
    }
    
    // Get all episodes for this show
    const episodes = await db.select().from(episodesTable).where(eq(episodesTable.showId, showId));
    
    // Determine which episodes need to be downloaded
    const downloadedEpisodes = new Set(episodes.filter(ep => ep.isDownloaded).map(ep => ep.episodeNumber));
    const totalEpisodes = show[0].totalEpisodes || 0;
    
    // Log the scan details
    await db.insert(logsTable).values({
      message: `Scanning ${show[0].title}: ${downloadedEpisodes.size}/${totalEpisodes} episodes downloaded`,
      level: 'info',
      createdAt: new Date(),
    });
    
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
      await db.insert(logsTable).values({
        message: `Searching for ${show[0].title} - Episode ${episode}`,
        level: 'info',
        createdAt: new Date(),
      });
      
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
          await db.insert(logsTable).values({
            message: `Found episode ${episode} of ${show[0].title}: ${result.title}`,
            level: 'success',
            createdAt: new Date(),
          });
        } else {
          await db.insert(logsTable).values({
            message: `No match found for episode ${episode} of ${show[0].title}`,
            level: 'info',
            createdAt: new Date(),
          });
        }
      } catch (error) {
        console.error(`Error searching for episode ${episode}:`, error);
        await db.insert(logsTable).values({
          message: `Error searching for episode ${episode} of ${show[0].title}`,
          level: 'error',
          createdAt: new Date(),
        });
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
    
    // Update scan state to idle
    await db.update(scanStateTable)
      .set({
        isScanning: false,
        status: 'idle',
        currentShowId: null,
      })
      .where(eq(scanStateTable.id, 1));
    
    // Log the completion of the scan
    await db.insert(logsTable).values({
      message: `Completed scan for ${show[0].title}`,
      level: 'success',
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Error scanning show:', error);
    
    // Log the error
    await db.insert(logsTable).values({
      message: `Error scanning show ID ${showId}: ${error}`,
      level: 'error',
      createdAt: new Date(),
    });
    
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
    // Log the start of the scan
    await db.insert(logsTable).values({
      message: 'Starting scan for all shows',
      level: 'info',
      createdAt: new Date(),
    });
    
    // Get all shows
    const shows = await db.select().from(showsTable);
    
    // Scan each show
    for (const show of shows) {
      // Update scan state to show current show
      await db.update(scanStateTable)
        .set({
          currentShowId: show.id,
          status: `Scanning ${show.title}`,
        })
        .where(eq(scanStateTable.id, 1));
      
      await scanShow(show.id, origin);
    }
    
    // Update scan state to idle
    await db.update(scanStateTable)
      .set({
        isScanning: false,
        status: 'idle',
        currentShowId: null,
      })
      .where(eq(scanStateTable.id, 1));
    
    // Log the completion of the scan
    await db.insert(logsTable).values({
      message: 'Completed scan for all shows',
      level: 'success',
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Error scanning all shows:', error);
    
    // Log the error
    await db.insert(logsTable).values({
      message: `Error scanning all shows: ${error}`,
      level: 'error',
      createdAt: new Date(),
    });
    
    // Update scan state to error
    await db.update(scanStateTable)
      .set({
        isScanning: false,
        status: 'error',
      })
      .where(eq(scanStateTable.id, 1));
  }
} 