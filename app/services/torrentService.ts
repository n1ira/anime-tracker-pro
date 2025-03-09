import { db } from '@/db/db';
import { settingsTable, showsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { logInfo, logError } from '@/app/utils/logging';
import { parseTitle, isValidEpisode } from '@/app/utils/torrentParser';
import { calculateAbsoluteEpisode } from '@/app/utils/episodeCalculator';

// Nyaa.si URL for anime torrents
const NYAA_URL = 'https://nyaa.si/';

/**
 * Search for torrents for a specific episode
 */
export async function searchTorrents(showId: number, season: number, episode: number) {
  try {
    // Get the show from the database
    const show = await db.select().from(showsTable).where(eq(showsTable.id, showId)).limit(1);

    if (show.length === 0) {
      return { success: false, message: 'Show not found' };
    }

    // Get episodes per season for this show
    const episodesPerSeason = show[0].episodesPerSeason || '12';

    // Parse the episodes per season (could be a number or JSON array)
    let parsedEpisodesPerSeason;
    try {
      parsedEpisodesPerSeason = JSON.parse(episodesPerSeason);
    } catch (e) {
      // If it's not valid JSON, assume it's a number
      parsedEpisodesPerSeason = parseInt(episodesPerSeason);
    }

    // Create episodesPerSeasonData for our calculator
    const episodesPerSeasonData = {
      [show[0].title]: {
        episodes_per_season: parsedEpisodesPerSeason,
      },
    };

    // Calculate absolute episode for better tracking
    const absoluteEpisode = calculateAbsoluteEpisode(
      show[0].title,
      season,
      episode,
      episodesPerSeasonData
    );

    // Log the search
    await logInfo(
      `Searching for ${show[0].title} S${season}E${episode} (Absolute Episode ${absoluteEpisode})`
    );

    // Try different search queries
    const searchQueries = [
      `${show[0].title} S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`,
      `${show[0].title} S${season} - ${episode.toString().padStart(2, '0')}`,
      `${show[0].title} ${episode}`, // Simple query with just the episode number
      `${show[0].title} ${absoluteEpisode}`, // Search with absolute episode number as well
    ];

    // Add alternateNames to search queries if available
    try {
      const alternateNames = JSON.parse(show[0].alternateNames || '[]');
      if (Array.isArray(alternateNames) && alternateNames.length > 0) {
        // Add alternate name queries
        for (const altName of alternateNames) {
          if (altName && typeof altName === 'string') {
            searchQueries.push(
              `${altName} S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`
            );
            searchQueries.push(`${altName} ${absoluteEpisode}`);
          }
        }
      }
    } catch (e) {
      console.error('Error parsing alternateNames:', e);
    }

    let results: Array<{ title: string; magnetLink: string; seeders: number }> = [];

    // Try each search query
    for (const query of searchQueries) {
      await logInfo(`Trying search query: ${query}`);

      try {
        // Search nyaa.si
        const response = await axios.get(NYAA_URL, {
          params: {
            f: 0,
            c: '0_0',
            q: query,
            s: 'seeders',
            o: 'desc',
          },
          timeout: 10000,
        });

        // Parse the HTML response
        const $ = cheerio.load(response.data);
        const searchResults: Array<{ title: string; magnetLink: string; seeders: number }> = [];

        // Process each row in the results table
        $('tr.danger, tr.default, tr.success').each((_, row) => {
          const titleAnchor = $(row).find('a[href^="/view/"]:not(.comments)');
          if (!titleAnchor.length) return;

          const title = titleAnchor.text().trim();
          const magnetTag = $(row).find('a[href^="magnet:"]');
          if (!magnetTag.length) return;

          // Extract seeders count (7th td element - index 6)
          const seeders = parseInt($(row).find('td').eq(6).text().trim(), 10) || 0;

          const magnetLink = magnetTag.attr('href') || '';

          searchResults.push({
            title,
            magnetLink,
            seeders, // Add seeders to the result
          });
        });

        if (searchResults.length > 0) {
          results = searchResults;
          break;
        }
      } catch (error) {
        console.error('Error searching torrents:', error);
        await logError(`Error searching with query: ${query}`);
      }
    }

    // If no results found, return error
    if (results.length === 0) {
      await logInfo(`No matches found for ${show[0].title} S${season}E${episode}`);
      return { success: false, message: 'No matches found' };
    }

    // Get OpenAI API key from settings
    const settings = await db.select().from(settingsTable).limit(1);

    if (settings.length === 0) {
      await logError('Settings not found. Please set it in the database.');
      return { success: false, message: 'Settings not found' };
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: settings[0].useSystemEnvVar
        ? process.env.OPENAI_API_KEY
        : settings[0].openaiApiKey || undefined,
    });

    // Parse titles and filter valid episodes
    const parsedResults: Array<{
      title: string;
      magnetLink: string;
      quality: string;
      size: string;
      seeders: number;
    }> = [];

    for (const result of results) {
      try {
        const parsed = await parseTitle(openai, result.title);

        // Check if this is a valid episode
        if (await isValidEpisode(show[0].title, season, episode, parsed)) {
          // Determine quality with a safe default
          let quality = 'unknown';
          if (parsed.quality) {
            quality = String(parsed.quality);
          }

          parsedResults.push({
            title: result.title,
            magnetLink: result.magnetLink,
            quality: quality,
            size: 'unknown',
            seeders: result.seeders || 0, // Include seeders
          });
        }
      } catch (error) {
        await logError(`Error parsing title: ${result.title}`);
      }
    }

    // If no valid episodes found after parsing, try direct matching
    if (parsedResults.length === 0) {
      // Direct matching for common patterns
      for (const result of results) {
        const title = result.title.toLowerCase();
        const showTitle = show[0].title.toLowerCase();

        // Check if the title contains the show name and episode number
        if (
          title.includes(showTitle) &&
          (title.includes(` - ${episode}`) ||
            title.includes(`e${episode}`) ||
            title.includes(`ep${episode}`) ||
            title.includes(` ${episode} `))
        ) {
          // Determine quality
          let quality = 'unknown';
          if (title.includes('1080p')) quality = '1080p';
          else if (title.includes('720p')) quality = '720p';
          else if (title.includes('480p')) quality = '480p';

          parsedResults.push({
            title: result.title,
            magnetLink: result.magnetLink,
            quality: quality,
            size: 'unknown',
            seeders: result.seeders || 0, // Include seeders here too
          });
        }
      }
    }

    // If still no valid episodes found, return error
    if (parsedResults.length === 0) {
      await logInfo(
        `No valid episodes found for ${show[0].title} S${season}E${episode} after parsing`
      );
      return { success: false, message: 'No matches found' };
    }

    // Sort by seeders first, then by quality
    parsedResults.sort((a, b) => {
      const qualityOrder: { [key: string]: number } = {
        '1080p': 3,
        '720p': 2,
        '480p': 1,
        unknown: 0,
      };

      // First prioritize by seeders count (higher is better)
      if (b.seeders !== a.seeders) {
        return b.seeders - a.seeders;
      }

      // Then by quality
      return (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0);
    });

    // Return the best match
    const bestMatch = parsedResults[0];

    await logInfo(`Found match for ${show[0].title} S${season}E${episode}: ${bestMatch.title}`);

    return {
      success: true,
      title: bestMatch.title,
      magnetLink: bestMatch.magnetLink,
      quality: bestMatch.quality,
      seeders: bestMatch.seeders,
    };
  } catch (error) {
    await logError(`Error searching torrents: ${error}`);
    return { success: false, message: 'Error searching torrents' };
  }
}

/**
 * Test search for torrents with a specific query
 */
export async function testSearch(query: string) {
  try {
    // Search nyaa.si
    const response = await axios.get(NYAA_URL, {
      params: {
        f: 0,
        c: '0_0',
        q: query,
        s: 'seeders',
        o: 'desc',
      },
      timeout: 10000,
    });

    // Parse the HTML response
    const $ = cheerio.load(response.data);
    const results: Array<{ title: string; magnetLink: string }> = [];

    // Process each row in the results table
    $('tr.danger, tr.default, tr.success').each((_, row) => {
      const titleAnchor = $(row).find('a[href^="/view/"]:not(.comments)');
      if (!titleAnchor.length) return;

      const title = titleAnchor.text().trim();
      const magnetTag = $(row).find('a[href^="magnet:"]');
      if (!magnetTag.length) return;

      const magnetLink = magnetTag.attr('href') || '';

      results.push({
        title,
        magnetLink,
      });
    });

    return {
      query,
      results,
    };
  } catch (error) {
    await logError(`Error in torrent search test: ${error}`);
    return { error: 'Failed to search for torrents' };
  }
}
