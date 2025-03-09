import { db } from '@/db/db';
import { scanStateTable, showsTable, episodesTable } from '@/db/schema';
import { eq, and, isNull, lte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { logInfo, logError } from '@/app/utils/logging';
import { calculateAbsoluteEpisode } from '@/app/utils/episodeCalculator';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { parseTitle, isValidEpisode } from '@/app/utils/torrentParser';
import OpenAI from 'openai';

// Nyaa.si URL for anime torrents
const NYAA_URL = 'https://nyaa.si/';

// Define the Episode type based on the schema
type Episode = {
  id: number;
  showId: number;
  season: number; // This field is missing in the schema but used in the code
  episodeNumber: number;
  title?: string; // This field is missing in the schema but used in the code
  isDownloaded: boolean | null;
  magnetLink: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/**
 * Initializes the scan state table if it doesn't exist
 */
export async function initializeScanState() {
  try {
    // Check for existing scan state
    const existingScanState = await db.select({ count: sql`count(*)` }).from(scanStateTable);
    if (!existingScanState || existingScanState.length === 0 || existingScanState[0].count === 0) {
      await logInfo('No scan state found, initializing');
      await db.insert(scanStateTable).values({
        isScanning: false,
        status: 'idle',
        currentShowId: null
      });
      await logInfo('Successfully initialized scan state table');
    }
  } catch (error) {
    await logError(`Error initializing scan state: ${error}`);
    throw error;
  }
}

/**
 * Gets the current scan state
 */
export async function getScanState() {
  try {
    await initializeScanState();
    const scanState = await db.select().from(scanStateTable).limit(1);
    
    if (!scanState || scanState.length === 0) {
      // Create a default scan state if none exists
      return {
        id: 0,
        isScanning: false,
        status: 'idle',
        currentShowId: null,
        startedAt: null,
        updatedAt: new Date().toISOString(),
        currentShow: null
      };
    }
    
    // Get the current show if there's a currentShowId
    let currentShow = null;
    if (scanState[0].currentShowId) {
      const show = await db.select()
        .from(showsTable)
        .where(eq(showsTable.id, scanState[0].currentShowId))
        .limit(1);
      
      if (show && show.length > 0) {
        currentShow = show[0];
      }
    }
    
    // Return a properly formatted scan state
    return {
      id: scanState[0].id,
      isScanning: scanState[0].isScanning ?? false,
      status: scanState[0].status ?? 'idle',
      currentShowId: scanState[0].currentShowId,
      startedAt: scanState[0].startedAt ? new Date(scanState[0].startedAt).toISOString() : null,
      updatedAt: scanState[0].updatedAt ? new Date(scanState[0].updatedAt).toISOString() : new Date().toISOString(),
      currentShow
    };
  } catch (error) {
    await logError(`Error getting scan state: ${error}`);
    // Return a safe default state in case of error
    return {
      id: 0,
      isScanning: false,
      status: 'error',
      currentShowId: null,
      startedAt: null,
      updatedAt: new Date().toISOString(),
      currentShow: null
    };
  }
}

/**
 * Updates the scan state
 */
export async function updateScanState(isScanning: boolean, status: string, currentShowId: number | null) {
  try {
    const currentState = await getScanState();
    await db.update(scanStateTable)
      .set({
        isScanning,
        status,
        currentShowId
      })
      .where(eq(scanStateTable.id, currentState.id));
    
    // Invalidate any cached scan state
    try {
      await fetch('/api/scan/status', { method: 'DELETE' });
    } catch (error) {
      console.error('Error invalidating scan state cache:', error);
    }
  } catch (error) {
    await logError(`Error updating scan state: ${error}`);
    throw error;
  }
}

/**
 * Scans a specific show for new episodes
 */
export async function scanShow(showId: number, origin: string, isPartOfBatchScan: boolean = false) {
  try {
    // Log the start of the scan
    await logInfo(`Starting scan for show ID: ${showId}`);
    
    // Get the show details
    const show = await db.select().from(showsTable).where(eq(showsTable.id, showId)).limit(1);
    
    if (show.length === 0) {
      await logError(`Show with ID ${showId} not found`);
      
      // Update scan state to idle only if not part of a batch scan
      if (!isPartOfBatchScan) {
        await updateScanState(false, 'Scan completed', null);
      }
      
      return false;
    }
    
    await logInfo(`Scanning show: ${show[0].title}`);
    
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
    } catch (error) {
      await logError(`Error parsing episodesPerSeason: ${error}`);
      episodesPerSeasonArray = Array(20).fill(12); // Default to 12 episodes per season
    }
    
    // Create episodesPerSeasonData for our calculator
    const episodesPerSeasonData = {
      [show[0].title]: {
        episodes_per_season: episodesPerSeasonArray
      }
    };
    
    // Find the next episode to download
    let nextEpisodeToDownload = null;
    
    // If no episodes are downloaded yet, start with S1E1
    if (downloadedEpisodes.length === 0) {
      nextEpisodeToDownload = { season: 1, episode: 1 };
    } else {
      // Find the highest downloaded episode
      // We need to add the season field to the episodes for calculation
      const episodesWithSeason = downloadedEpisodes.map(ep => ({
        ...ep,
        season: 1 // Default to season 1 since it's not in the schema
      })) as Episode[];
      
      const highestDownloaded = episodesWithSeason.reduce((highest, current) => {
        const currentAbsolute = calculateAbsoluteEpisode(
          show[0].title,
          current.season, 
          current.episodeNumber,
          episodesPerSeasonData
        );
        const highestAbsolute = calculateAbsoluteEpisode(
          show[0].title,
          highest.season, 
          highest.episodeNumber,
          episodesPerSeasonData
        );
        return currentAbsolute > highestAbsolute ? current : highest;
      }, episodesWithSeason[0]);
      
      // Calculate the next episode
      let nextEpisode = highestDownloaded.episodeNumber + 1;
      let nextSeason = highestDownloaded.season;
      
      // Check if we need to move to the next season
      if (nextEpisode > (episodesPerSeasonArray[nextSeason - 1] || 12)) {
        nextEpisode = 1;
        nextSeason++;
      }
      
      nextEpisodeToDownload = { season: nextSeason, episode: nextEpisode };
    }
    
    if (!nextEpisodeToDownload) {
      await logInfo(`No next episode to download for ${show[0].title}`);
      
      // Update scan state to idle only if not part of a batch scan
      if (!isPartOfBatchScan) {
        await updateScanState(false, 'Scan completed', null);
      }
      
      return false;
    }
    
    await logInfo(`Looking for ${show[0].title} S${nextEpisodeToDownload.season}E${nextEpisodeToDownload.episode}`);
    
    // Search for the episode
    const searchResult = await searchEpisode(
      show[0], 
      nextEpisodeToDownload.season, 
      nextEpisodeToDownload.episode,
      origin
    );
    
    if (!searchResult || !searchResult.success) {
      await logInfo(`No matches found for ${show[0].title} S${nextEpisodeToDownload.season}E${nextEpisodeToDownload.episode}`);
      
      // Update scan state to idle only if not part of a batch scan
      if (!isPartOfBatchScan) {
        await updateScanState(false, 'Scan completed', null);
      }
      
      return false;
    }
    
    // Found a match, create or update the episode
    const existingEpisode = allEpisodes.find(ep => 
      ep.episodeNumber === nextEpisodeToDownload.episode
    );
    
    if (existingEpisode) {
      // Update existing episode
      await db.update(episodesTable)
        .set({
          magnetLink: searchResult.magnetLink,
          isDownloaded: true,
          updatedAt: new Date()
        })
        .where(eq(episodesTable.id, existingEpisode.id));
        
      await logInfo(`Updated episode ${show[0].title} S${nextEpisodeToDownload.season}E${nextEpisodeToDownload.episode}`);
    } else {
      // Create new episode
      await db.insert(episodesTable).values({
        showId,
        episodeNumber: nextEpisodeToDownload.episode,
        magnetLink: searchResult.magnetLink,
        isDownloaded: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await logInfo(`Created new episode ${show[0].title} S${nextEpisodeToDownload.season}E${nextEpisodeToDownload.episode}`);
    }
    
    // Update scan state to idle only if not part of a batch scan
    if (!isPartOfBatchScan) {
      await updateScanState(false, 'Scan completed', null);
    }
    
    return true;
  } catch (error) {
    await logError(`Error scanning show: ${error}`);
    
    // Update scan state to idle only if not part of a batch scan
    if (!isPartOfBatchScan) {
      await updateScanState(false, 'Error scanning show', null);
    }
    
    return false;
  }
}

/**
 * Searches for a specific episode of a show
 */
async function searchEpisode(show: any, season: number, episode: number, origin: string) {
  try {
    // Make a request to the torrent search endpoint
    const response = await fetch(`${origin}/api/torrent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        showId: show.id,
        season,
        episode,
      }),
    });
    
    return await response.json();
  } catch (error) {
    await logError(`Error searching for episode: ${error}`);
    return { success: false, message: "Error searching for episode" };
  }
}

/**
 * Scans all shows for new episodes
 */
export async function scanAllShows(origin: string) {
  try {
    // Get all shows
    const shows = await db.select().from(showsTable);
    
    if (shows.length === 0) {
      await logInfo('No shows found to scan');
      await updateScanState(false, 'No shows found to scan', null);
      return false;
    }
    
    await logInfo(`Starting scan for all ${shows.length} shows`);
    
    // Update scan state to scanning
    await updateScanState(true, 'Scanning all shows', null);
    
    // Scan each show
    for (const show of shows) {
      // Update scan state with current show
      await updateScanState(true, `Scanning ${show.title}`, show.id);
      
      // Scan the show
      await scanShow(show.id, origin, true);
    }
    
    // Update scan state to idle
    await updateScanState(false, 'Scan completed', null);
    
    await logInfo('Completed scan for all shows');
    
    return true;
  } catch (error) {
    await logError(`Error scanning all shows: ${error}`);
    await updateScanState(false, 'Error scanning all shows', null);
    return false;
  }
}

/**
 * Truncates a title to a specified length
 */
export function truncateTitle(title: string, maxLength: number = 20): string {
  if (title.length <= maxLength) {
    return title;
  }
  return title.substring(0, maxLength) + '...';
} 