import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { settingsTable, logsTable, showsTable, episodesTable } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';

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
    
    // Log the search
    await logMessage(`Searching for ${show[0].title} S${season}E${episode}`, 'info');
    
    // Try different search queries
    const searchQueries = [
      `${show[0].title} S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`,
      `${show[0].title} S${season} - ${episode.toString().padStart(2, '0')}`,
      `${show[0].title} ${episode}` // Simple query with just the episode number
    ];
    
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
        if (isValidEpisode(show[0].title, season, episode, parsed)) {
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
    // Get all shows from the database for context
    const shows = await db.select().from(showsTable);
    const knownShows = shows.reduce((acc: any, show) => {
      acc[show.title] = {
        // Use default values since these fields don't exist in the schema
        quality: "1080p", // Default quality
        episodes_per_season: 12 // Default episodes per season
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
Rules for ${JSON.stringify(knownShows, null, 2)}
If season markers are missing, derive season based on episode counts.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: title }
      ],
      temperature: 0.1
    });

    let rawResponse = response.choices[0].message.content || '{}';
    
    // Remove markdown formatting if present
    if (rawResponse.startsWith('```json')) {
      const parts = rawResponse.split('```json');
      if (parts.length > 1) {
        rawResponse = parts[1];
        const closingParts = rawResponse.split('```');
        if (closingParts.length > 1) {
          rawResponse = closingParts[0];
        }
      }
      rawResponse = rawResponse.trim();
    }

    try {
      const result = JSON.parse(rawResponse);
      
      // Ensure season is a number
      result.season = parseInt(result.season || 1, 10);
      
      // Ensure episode is a number if present
      if (result.episode !== null && result.episode !== undefined) {
        result.episode = parseInt(result.episode, 10);
      }
      
      // Ensure quality is a string
      result.quality = result.quality || 'unknown';
      
      // Ensure batch_episodes is an array of numbers
      result.batch_episodes = Array.isArray(result.batch_episodes) 
        ? result.batch_episodes.map((ep: any) => parseInt(ep, 10)) 
        : [];
      
      // Ensure is_batch is a boolean
      result.is_batch = !!result.is_batch;
      
      // Ensure show is a string and normalize it
      result.show = result.show || '';
      
      await logMessage(`Parsed title "${title}" to: ${JSON.stringify(result)}`, 'info');
      
      return result;
    } catch (error) {
      await logMessage(`Error parsing JSON from OpenAI response for title "${title}": ${error}`, 'error');
      await logMessage(`Raw response: ${rawResponse}`, 'error');
      
      // Fallback parsing for common patterns
      return fallbackParsing(title);
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    await logMessage(`Error calling OpenAI API: ${error}`, 'error');
    return fallbackParsing(title);
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
  
  // Extract season and episode
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
      } else if (match.length === 2) {
        // Pattern with just episode
        result.episode = parseInt(match[1], 10);
      }
      break;
    }
  }
  
  // Extract show name - take everything before the season/episode markers
  const showNamePatterns = [
    /^(.*?)(?:S\d+E\d+|\sE\d+|\s-\s\d+|\sSeason\s*\d+)/i
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
function isValidEpisode(showTitle: string, targetSeason: number, targetEpisode: number, parsed: any): boolean {
  // Check if the show name matches
  const normalizedShowTitle = normalizeShowName(showTitle);
  const normalizedParsedShow = normalizeShowName(parsed.show || '');
  
  // Check if the show names match
  if (normalizedShowTitle !== normalizedParsedShow && 
      !normalizedShowTitle.includes(normalizedParsedShow) && 
      !normalizedParsedShow.includes(normalizedShowTitle)) {
    return false;
  }
  
  // Check if the season and episode match
  if (parsed.is_batch) {
    // For batch releases, check if the target episode is in the batch
    const batchEpisodes = parsed.batch_episodes || [];
    return parsed.season === targetSeason && batchEpisodes.includes(targetEpisode);
  } else {
    // For single episode releases, check exact match
    // If season is not specified in the parsed result, assume it's season 1
    const parsedSeason = parsed.season || 1;
    return parsedSeason === targetSeason && parsed.episode === targetEpisode;
  }
} 