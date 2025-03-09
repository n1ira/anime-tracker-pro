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
import { invalidateCache } from '@/app/api/scan/status/route';
import { searchTorrents } from '@/app/services/torrentService';

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
    const existingScanState = await db.select().from(scanStateTable);
    
    if (!existingScanState || existingScanState.length === 0) {
      await logInfo('No scan state found, initializing');
      await db.insert(scanStateTable).values({
        isScanning: false,
        status: 'idle',
        currentShowId: null,
        updatedAt: new Date()
      });
      await logInfo('Successfully initialized scan state table');
    } else {
      // If the status is null or empty, update it to 'idle'
      const currentState = existingScanState[0];
      if (!currentState.status) {
        await logInfo('Scan state found but status is null, updating to idle');
        await db.update(scanStateTable)
          .set({
            status: 'idle',
            updatedAt: new Date()
          })
          .where(eq(scanStateTable.id, currentState.id));
        await logInfo('Successfully updated scan state status to idle');
      }
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
      const defaultState = {
        id: 0,
        isScanning: false,
        status: 'idle',
        currentShowId: null,
        startedAt: null,
        updatedAt: new Date().toISOString(),
        currentShow: null
      };
      await logInfo('No scan state found, returning default state');
      return defaultState;
    }
    
    // Get the current show if there's a currentShowId
    let currentShow = null;
    if (scanState[0].currentShowId) {
      try {
        const show = await db.select()
          .from(showsTable)
          .where(eq(showsTable.id, scanState[0].currentShowId))
          .limit(1);
        
        if (show && show.length > 0) {
          currentShow = show[0];
          await logInfo(`Retrieved currentShow for scan state: ${currentShow.title} (ID: ${currentShow.id})`);
        } else {
          await logInfo(`No show found with ID: ${scanState[0].currentShowId}`);
        }
      } catch (showError) {
        await logError(`Error retrieving show with ID ${scanState[0].currentShowId}: ${showError}`);
      }
    }
    
    // Ensure the status has a valid value and not null or undefined
    const status = scanState[0].status || 'idle';
    
    // Return a properly formatted scan state
    const formattedScanState = {
      id: scanState[0].id,
      isScanning: scanState[0].isScanning ?? false,
      status: status,
      currentShowId: scanState[0].currentShowId,
      startedAt: scanState[0].startedAt ? new Date(scanState[0].startedAt).toISOString() : null,
      updatedAt: scanState[0].updatedAt ? new Date(scanState[0].updatedAt).toISOString() : new Date().toISOString(),
      currentShow
    };
    
    // Log the formatted scan state (excluding the full currentShow object for brevity)
    await logInfo(`Returning scan state: isScanning=${formattedScanState.isScanning}, status=${formattedScanState.status}, currentShowId=${formattedScanState.currentShowId}, hasCurrentShow=${currentShow !== null}`);
    
    return formattedScanState;
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
    // Truncate status to 50 characters to match database constraint
    const truncatedStatus = status.length > 50 ? status.substring(0, 47) + '...' : status;
    
    const currentState = await getScanState();
    await db.update(scanStateTable)
      .set({
        isScanning,
        status: truncatedStatus,
        currentShowId,
        startedAt: isScanning ? new Date() : null,
        updatedAt: new Date()
      })
      .where(eq(scanStateTable.id, currentState.id));
    
    // Invalidate any cached scan state
    invalidateCache();
    
    await logInfo(`Updated scan state: isScanning=${isScanning}, status=${truncatedStatus}, currentShowId=${currentShowId}`);
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
    
    // Update scan state to indicate we're scanning this show
    await updateScanState(true, `Scanning show ID: ${showId}`, showId);
    
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
    
    // Update scan state with show title now that we have it
    await updateScanState(true, `Scanning ${show[0].title}`, showId);
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
      await logInfo(`No downloaded episodes found for ${show[0].title}, starting with S1E1`);
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
      await logInfo(`Highest downloaded episode for ${show[0].title} is S${highestDownloaded.season}E${highestDownloaded.episodeNumber}, looking for S${nextSeason}E${nextEpisode}`);
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
    // Use torrentService directly instead of making a fetch request
    const result = await searchTorrents(show.id, season, episode);
    
    // Log search result
    if (result.success) {
      await logInfo(`Found match for ${show.title} S${season}E${episode}: ${result.title}`);
    } else {
      await logInfo(`No matches found for ${show.title} S${season}E${episode}`);
    }
    
    return result;
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
      // Use a shorter status message to avoid exceeding the 50 char limit
      const showTitle = truncateTitle(show.title, 20);
      await updateScanState(true, `Scanning ${showTitle}`, show.id);
      
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