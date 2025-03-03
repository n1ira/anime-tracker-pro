import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { settingsTable, logsTable, showsTable, episodesTable } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { calculateAbsoluteEpisode } from '@/app/utils/episodeCalculator';

// Nyaa.si URL for anime torrents
const NYAA_URL = 'https://nyaa.si/';

// Function to normalize show name for comparison
function normalizeShowName(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[''\",:;\-]/g, '')
    .replace(/\s+/g, ' ');
}

// Function to log messages to the database
async function logMessage(message: string, level: 'info' | 'success' | 'error' = 'info') {
  try {
    await db.insert(logsTable).values({
      message,
      level,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Error logging message:', error);
  }
}

// POST endpoint for searching torrents
export async function POST(request: Request) {
  try {
    const { showId, season, episode } = await request.json();
    
    // Get the show from the database
    const show = await db.select().from(showsTable).where(eq(showsTable.id, showId)).limit(1);
    
    if (show.length === 0) {
      return NextResponse.json({ success: false, message: "Show not found" }, { status: 404 });
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
        episodes_per_season: parsedEpisodesPerSeason
      }
    };
    
    // Calculate absolute episode for better tracking
    const absoluteEpisode = calculateAbsoluteEpisode(
      show[0].title, 
      season, 
      episode,
      episodesPerSeasonData
    );
    
    // Log the search
    await logMessage(`Searching for ${show[0].title} S${season}E${episode} (Absolute Episode ${absoluteEpisode})`, 'info');
    
    // Try different search queries
    const searchQueries = [
      `${show[0].title} S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`,
      `${show[0].title} S${season} - ${episode.toString().padStart(2, '0')}`,
      `${show[0].title} ${episode}`, // Simple query with just the episode number
      `${show[0].title} ${absoluteEpisode}` // Search with absolute episode number as well
    ];
    
    // Add alternateNames to search queries if available
    try {
      const alternateNames = JSON.parse(show[0].alternateNames || '[]');
      if (Array.isArray(alternateNames) && alternateNames.length > 0) {
        // Add alternate name queries
        for (const altName of alternateNames) {
          if (altName && typeof altName === 'string') {
            searchQueries.push(`${altName} S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`);
            searchQueries.push(`${altName} ${absoluteEpisode}`);
          }
        }
      }
    } catch (e) {
      console.error('Error parsing alternateNames:', e);
    }
    
    let results: Array<{ title: string; magnetLink: string }> = [];
    
    // Try each search query
    for (const query of searchQueries) {
      await logMessage(`Trying search query: ${query}`, 'info');
      
      try {
        // Search nyaa.si
        const response = await axios.get(NYAA_URL, {
          params: {
            f: 0,
            c: '0_0',
            q: query,
            s: 'seeders',
            o: 'desc'
          },
          timeout: 10000
        });

        // Parse the HTML response
        const $ = cheerio.load(response.data);
        const searchResults: Array<{ title: string; magnetLink: string }> = [];

        // Process each row in the results table
        $('tr.danger, tr.default, tr.success').each((_, row) => {
          const titleAnchor = $(row).find('a[href^="/view/"]:not(.comments)');
          if (!titleAnchor.length) return;

          const title = titleAnchor.text().trim();
          const magnetTag = $(row).find('a[href^="magnet:"]');
          if (!magnetTag.length) return;

          const magnetLink = magnetTag.attr('href') || '';
          
          searchResults.push({
            title,
            magnetLink
          });
        });

        if (searchResults.length > 0) {
          results = searchResults;
          break;
        }
      } catch (error) {
        console.error('Error searching torrents:', error);
        await logMessage(`Error searching with query: ${query}`, 'error');
      }
    }
    
    // If no results found, return error
    if (results.length === 0) {
      await logMessage(`No matches found for ${show[0].title} S${season}E${episode}`, 'info');
      
      return NextResponse.json({ success: false, message: "No matches found" }, { status: 404 });
    }
    
    // Get OpenAI API key from settings
    const settings = await db.select().from(settingsTable).limit(1);
    
    if (settings.length === 0) {
      await logMessage('Settings not found. Please set it in the database.', 'error');
      return NextResponse.json({ success: false, message: "Settings not found" }, { status: 500 });
    }
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: settings[0].useSystemEnvVar 
        ? process.env.OPENAI_API_KEY 
        : (settings[0].openaiApiKey || undefined)
    });
    
    // Parse titles and filter valid episodes
    const parsedResults: Array<{ title: string; magnetLink: string; quality: string; size: string }> = [];
    
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
            size: 'unknown' // Since we don't have size in the result object
          });
        }
      } catch (error) {
        await logMessage(`Error parsing title: ${result.title}`, 'error');
      }
    }
    
    // If no valid episodes found after parsing, try direct matching
    if (parsedResults.length === 0) {
      // Direct matching for common patterns
      for (const result of results) {
        const title = result.title.toLowerCase();
        const showTitle = show[0].title.toLowerCase();
        
        // Check if the title contains the show name and episode number
        if (title.includes(showTitle) && 
            (title.includes(` - ${episode}`) || 
             title.includes(`e${episode}`) || 
             title.includes(`ep${episode}`) ||
             title.includes(` ${episode} `))) {
          
          // Determine quality
          let quality = 'unknown';
          if (title.includes('1080p')) quality = '1080p';
          else if (title.includes('720p')) quality = '720p';
          else if (title.includes('480p')) quality = '480p';
          
          parsedResults.push({
            title: result.title,
            magnetLink: result.magnetLink,
            quality: quality,
            size: 'unknown' // Since we don't have size in the result object
          });
        }
      }
    }
    
    // If still no valid episodes found, return error
    if (parsedResults.length === 0) {
      await logMessage(`No valid episodes found for ${show[0].title} S${season}E${episode} after parsing`, 'info');
      
      return NextResponse.json({ success: false, message: "No matches found" }, { status: 404 });
    }
    
    // Sort by quality (1080p > 720p > 480p > unknown)
    parsedResults.sort((a, b) => {
      const qualityOrder: { [key: string]: number } = {
        '1080p': 3,
        '720p': 2,
        '480p': 1,
        'unknown': 0
      };
      
      return (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0);
    });
    
    return NextResponse.json({ 
      success: true, 
      results: parsedResults
    });
  } catch (error) {
    console.error('Error searching for torrents:', error);
    
    return NextResponse.json({ 
      success: false, 
      message: "Error searching for torrents" 
    }, { status: 500 });
  }
}

// Function to parse a torrent title using OpenAI
async function parseTitle(openai: OpenAI, title: string): Promise<{
  show: string;
  season: number;
  episode: number | null;
  is_batch: boolean;
  quality: string;
  batch_episodes: number[];
}> {
  try {
    // First try fallback parsing to avoid unnecessary API calls
    const fallbackResult = fallbackParsing(title);
    if (fallbackResult) {
      await logMessage(`Parsed title "${title}" to: ${JSON.stringify(fallbackResult)}`, 'info');
      return fallbackResult;
    }

    // Set a timeout for the OpenAI request to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI request timeout')), 5000);
    });

    // Get all shows from the database for context
    const shows = await db.select().from(showsTable);
    const knownShows = shows.reduce((acc: any, show) => {
      // Parse episodes per season
      let parsedEpisodesPerSeason;
      try {
        parsedEpisodesPerSeason = JSON.parse(show.episodesPerSeason || '12');
      } catch (e) {
        parsedEpisodesPerSeason = parseInt(show.episodesPerSeason || '12');
      }
      
      acc[show.title] = {
        quality: show.quality || "1080p",
        episodes_per_season: parsedEpisodesPerSeason
      };
      return acc;
    }, {});

    const systemPrompt = `Extract anime metadata as JSON with:
- show: normalized title
- season: number
- episode: number (null if batch)
- is_batch: boolean
- quality: string
- batch_episodes: array of episode numbers (if batch)

Important parsing rules:
1. Pay careful attention to season markers in titles (S1, S2, Season 1, Season 2, etc.)
2. When a title contains "S2 - 06", this means season 2, episode 6
3. Look for season information in parentheses or brackets
4. If a show name contains "S2" or similar, make sure to set season=2

Show metadata for reference: ${JSON.stringify(knownShows, null, 2)}
If season markers are missing, derive season based on episode counts.`;

    // Log the system prompt we're sending to OpenAI
    console.log(`DEBUG: OpenAI system prompt for title "${title}": ${systemPrompt}`);

    // Race the OpenAI request with a timeout
    const responsePromise = openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Parse this anime torrent title: "${title}"` }
      ],
      temperature: 0,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    });

    const response = await Promise.race([responsePromise, timeoutPromise]) as any;

    // Log the complete raw response from OpenAI for debugging - backend only
    console.log(`DEBUG: OpenAI raw response for "${title}": ${JSON.stringify({
      model: response.model,
      usage: response.usage,
      function_call: response.choices[0]?.message?.function_call,
      finish_reason: response.choices[0]?.finish_reason,
      content: response.choices[0]?.message?.content,
    })}`);

    // Parse the response
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    
    // Keep this log for the frontend, but make it minimal
    await logMessage(`Parsed title "${title}" to: ${JSON.stringify(parsed)}`, 'info');
    
    return parsed;
  } catch (error) {
    console.error('Error parsing title with OpenAI:', error);
    await logMessage(`Error parsing title with OpenAI: ${title}`, 'error');
    
    // Fall back to regex parsing
    const fallbackResult = fallbackParsing(title);
    if (fallbackResult) {
      await logMessage(`Fallback parsed title "${title}" to: ${JSON.stringify(fallbackResult)}`, 'info');
      return fallbackResult;
    }
    
    // If all else fails, return a basic structure
    return {
      show: title,
      season: 1,
      episode: 1,
      is_batch: false,
      quality: '1080p',
      batch_episodes: []
    };
  }
}

// Fallback parsing for common patterns in anime titles
function fallbackParsing(title: string) {
  const result: {
    show: string;
    season: number;
    episode: number | null;
    is_batch: boolean;
    quality: string;
    batch_episodes: number[];
    absoluteEpisode?: number;
  } = {
    show: '',
    season: 1,
    episode: null,
    is_batch: false,
    quality: 'unknown',
    batch_episodes: []
  };
  
  // Extract quality
  if (title.includes('1080p')) {
    result.quality = '1080p';
  } else if (title.includes('720p')) {
    result.quality = '720p';
  } else if (title.includes('480p')) {
    result.quality = '480p';
  }
  
  // First, check for standalone season markers (before checking episodes)
  // This handles patterns like "Title S2 - 09"
  const seasonPatterns = [
    /\bS(\d+)\b(?!\d*E)/i,   // S2 (not followed by E)
    /\bSeason\s*(\d+)\b/i,   // Season 2
  ];
  
  for (const pattern of seasonPatterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      result.season = parseInt(match[1], 10);
      break;
    }
  }
  
  // Extract season and episode together
  const seasonEpisodePatterns = [
    /S(\d+)E(\d+)/i,                // S01E01
    /Season\s*(\d+)\s*Episode\s*(\d+)/i, // Season 1 Episode 1
    /\s-\s(\d+)\s/,                 // - 21 (common for anime with just episode number)
    /\s-\s(\d+)$/,                  // - 21 at the end
    /\sE(\d+)/i                     // E21
  ];
  
  for (const pattern of seasonEpisodePatterns) {
    const match = title.match(pattern);
    if (match) {
      if (match.length === 3) {
        // Pattern with both season and episode
        result.season = parseInt(match[1], 10);
        result.episode = parseInt(match[2], 10);
        break;
      } else if (match.length === 2) {
        // Pattern with just episode number
        // Don't override season if already set by standalone season pattern
        result.episode = parseInt(match[1], 10);
        break;
      }
    }
  }
  
  // Extract show name - take everything before the season/episode markers
  const showNamePatterns = [
    /^(.*?)(?:S\d+\b|\s+S\d+\s+|\sE\d+|\s-\s\d+|\sSeason\s*\d+)/i
  ];
  
  for (const pattern of showNamePatterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      result.show = match[1].trim();
      break;
    }
  }
  
  // If we couldn't extract a show name, use a simple approach
  if (!result.show) {
    // Take the first part of the title before any brackets or dashes
    const simpleName = title.split(/[\[\(]/)[0].split('-')[0].trim();
    result.show = simpleName;
  }
  
  return result;
}

// Function to check if a parsed title matches the target episode
async function isValidEpisode(
  showTitle: string, 
  targetSeason: number, 
  targetEpisode: number, 
  parsed: any
): Promise<boolean> {
  // Check if the show name matches
  const normalizedShowTitle = normalizeShowName(showTitle);
  const normalizedParsedShow = normalizeShowName(parsed.show || '');
  
  // Check if the show names match
  if (normalizedShowTitle !== normalizedParsedShow && 
      !normalizedShowTitle.includes(normalizedParsedShow) && 
      !normalizedParsedShow.includes(normalizedShowTitle)) {
    console.log(`DEBUG: Episode match failed: Show name mismatch for "${showTitle}" vs "${parsed.show}"`);
    return false;
  }
  
  // Get show from database to get episodesPerSeason
  const show = await db.select().from(showsTable).where(eq(showsTable.title, showTitle)).limit(1);
  
  if (show.length === 0) {
    // Show not found, fall back to direct matching
    console.log(`DEBUG: Show not found in database, falling back to direct matching for "${showTitle}"`);
    return directEpisodeMatch(targetSeason, targetEpisode, parsed);
  }
  
  // Get episodes per season data
  let episodesPerSeason;
  try {
    episodesPerSeason = JSON.parse(show[0].episodesPerSeason || '12');
    console.log(`DEBUG: Parsed episodesPerSeason for "${showTitle}": ${JSON.stringify(episodesPerSeason)}`);
  } catch (e) {
    // If not valid JSON, assume it's a number
    episodesPerSeason = parseInt(show[0].episodesPerSeason || '12');
    console.log(`DEBUG: Using fixed episodesPerSeason for "${showTitle}": ${episodesPerSeason}`);
  }
  
  // Create the knownShows data for the calculator
  const knownShows = {
    [showTitle]: {
      episodes_per_season: episodesPerSeason
    }
  };
  
  // Calculate the target absolute episode
  const targetAbsoluteEpisode = calculateAbsoluteEpisode(
    showTitle,
    targetSeason,
    targetEpisode,
    knownShows
  );
  
  // Calculate the parsed absolute episode if we have season and episode
  if (parsed.season && parsed.episode) {
    const parsedAbsoluteEpisode = calculateAbsoluteEpisode(
      showTitle,
      parsed.season,
      parsed.episode,
      knownShows
    );
    
    // Log for debugging - keep minimal for frontend
    await logMessage(`Comparing episodes for ${showTitle}: Target S${targetSeason}E${targetEpisode} (Absolute: ${targetAbsoluteEpisode}) vs Parsed S${parsed.season}E${parsed.episode} (Absolute: ${parsedAbsoluteEpisode})`, 'info');
    
    // Detailed debug log for backend only
    console.log(`DEBUG: Episode comparison details - episodesPerSeason=${JSON.stringify(episodesPerSeason)}, targetSeason=${targetSeason}, targetEpisode=${targetEpisode}, parsedSeason=${parsed.season}, parsedEpisode=${parsed.episode}`);
    
    // Check if the absolute episodes match
    if (parsedAbsoluteEpisode === targetAbsoluteEpisode) {
      console.log(`DEBUG: MATCH FOUND! Absolute episodes match: ${parsedAbsoluteEpisode} === ${targetAbsoluteEpisode}`);
      return true;
    } else {
      // Log why the match failed - backend only
      console.log(`DEBUG: Episode match failed: Absolute episodes don't match: ${parsedAbsoluteEpisode} !== ${targetAbsoluteEpisode}`);
    }
  } else {
    console.log(`DEBUG: Episode match evaluation skipped: Missing season or episode data in parsed result`);
  }
  
  // If batch, check if target episode is in the batch
  if (parsed.is_batch && parsed.batch_episodes && parsed.batch_episodes.length > 0) {
    console.log(`DEBUG: Checking batch episodes: ${JSON.stringify(parsed.batch_episodes)}`);
    
    // Check if any of the batch episodes match our target when converted to absolute
    for (const batchEpisode of parsed.batch_episodes) {
      const batchAbsoluteEpisode = calculateAbsoluteEpisode(
        showTitle,
        parsed.season || 1,
        batchEpisode,
        knownShows
      );
      
      console.log(`DEBUG: Checking batch episode match: Target absolute ${targetAbsoluteEpisode} vs Batch absolute ${batchAbsoluteEpisode}`);
      
      if (batchAbsoluteEpisode === targetAbsoluteEpisode) {
        console.log(`DEBUG: MATCH FOUND in batch! Absolute episodes match: ${batchAbsoluteEpisode} === ${targetAbsoluteEpisode}`);
        return true;
      }
    }
    
    console.log(`DEBUG: No matching episodes found in batch`);
  }
  
  // Fall back to direct matching
  console.log(`DEBUG: Falling back to direct matching for ${showTitle}`);
  return directEpisodeMatch(targetSeason, targetEpisode, parsed);
}

// Helper function for direct episode matching
async function directEpisodeMatch(targetSeason: number, targetEpisode: number, parsed: any): Promise<boolean> {
  // For single episode releases, check exact match
  // If season is not specified in the parsed result, assume it's season 1
  const parsedSeason = parsed.season || 1;
  const parsedEpisode = parsed.episode || 0;
  
  // Only log this info on the backend
  console.log(`DEBUG: Direct episode matching: Target S${targetSeason}E${targetEpisode} vs Parsed S${parsedSeason}E${parsedEpisode}`);
  
  // First try exact match by season and episode
  let isMatch = parsedSeason === targetSeason && parsedEpisode === targetEpisode;
  
  // If no match and we're looking at a higher season, try to match on show patterns
  if (!isMatch && targetSeason > 1 && parsed.show) {
    // Check if the title contains a season marker matching our target
    const seasonMarker = `s${targetSeason}`;
    const hasMatchingSeasonInTitle = parsed.show.toLowerCase().includes(seasonMarker);
    
    // If the episode numbers match and the title suggests it's our target season
    if (hasMatchingSeasonInTitle && parsedEpisode === targetEpisode) {
      console.log(`DEBUG: Title contains S${targetSeason} and matching episode number ${targetEpisode}`);
      isMatch = true;
    }
  }
  
  if (isMatch) {
    // Log success but keep it simple for frontend
    await logMessage(`Direct match found for S${targetSeason}E${targetEpisode}`, 'success');
  } else {
    // Keep this log minimal for frontend
    await logMessage(`Direct match failed: S${targetSeason}E${targetEpisode} !== S${parsedSeason}E${parsedEpisode}`, 'info');
  }
  
  return isMatch;
} 