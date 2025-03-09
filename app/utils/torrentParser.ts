import OpenAI from 'openai';
import { logError, logInfo } from './logging';

/**
 * Normalizes a show name for comparison
 */
export function normalizeShowName(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[''\",:;\-]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Parses a torrent title using OpenAI
 */
export async function parseTitle(openai: OpenAI, title: string): Promise<{
  show: string;
  season: number;
  episode: number | null;
  is_batch: boolean;
  quality: string;
  batch_episodes: number[];
}> {
  try {
    // First try basic parsing
    const basicResult = basicTitleParsing(title);
    if (basicResult) {
      await logInfo(`Parsed title using basic parsing: ${JSON.stringify(basicResult)}`, true);
      return basicResult;
    }

    // Then try fallback parsing
    const fallbackResult = fallbackParsing(title);
    if (fallbackResult) {
      await logInfo(`Parsed title using fallback parsing: ${JSON.stringify(fallbackResult)}`, true);
      return fallbackResult;
    }

    // If both fail, use OpenAI
    return await makeOpenAIRequest(openai, title);
  } catch (error) {
    await logError(`Error parsing title: ${title}`, true);
    throw error;
  }
}

/**
 * Makes an OpenAI request to parse a torrent title
 */
async function makeOpenAIRequest(openai: OpenAI, title: string, retryCount = 0, maxRetries = 2) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that parses anime torrent titles. Extract the show name, season number, episode number, and quality. If it's a batch, set is_batch to true and provide the batch_episodes array. Return ONLY valid JSON.`
        },
        {
          role: "user",
          content: `Parse this anime torrent title: "${title}". Return a JSON object with these fields: show, season, episode, is_batch, quality, batch_episodes.`
        }
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    try {
      const parsed = JSON.parse(content);
      return {
        show: parsed.show || "",
        season: parsed.season || 1,
        episode: parsed.episode || null,
        is_batch: parsed.is_batch || false,
        quality: parsed.quality || "unknown",
        batch_episodes: parsed.batch_episodes || []
      };
    } catch (parseError) {
      throw new Error(`Failed to parse OpenAI response: ${parseError}`);
    }
  } catch (error) {
    if (retryCount < maxRetries) {
      await logInfo(`Retrying OpenAI request (${retryCount + 1}/${maxRetries})`, true);
      return makeOpenAIRequest(openai, title, retryCount + 1, maxRetries);
    }
    throw error;
  }
}

/**
 * Basic title parsing using regex patterns
 */
function basicTitleParsing(title: string) {
  // Common patterns for anime titles
  const seasonEpisodePatterns = [
    // S01E01 pattern
    /(.+?)[_.\s-]*S(\d+)[_.\s-]*E(\d+)[_.\s-]*(.*)/i,
    // Season 1 Episode 1 pattern
    /(.+?)[_.\s-]*Season[_.\s-]*(\d+)[_.\s-]*Episode[_.\s-]*(\d+)[_.\s-]*(.*)/i,
    // 01x01 pattern
    /(.+?)[_.\s-]*(\d+)x(\d+)[_.\s-]*(.*)/i,
  ];

  for (const pattern of seasonEpisodePatterns) {
    const match = title.match(pattern);
    if (match) {
      const [, show, season, episode, rest] = match;
      
      // Extract quality
      let quality = "unknown";
      if (rest.includes("1080p")) quality = "1080p";
      else if (rest.includes("720p")) quality = "720p";
      else if (rest.includes("480p")) quality = "480p";
      
      return {
        show: show.trim(),
        season: parseInt(season, 10),
        episode: parseInt(episode, 10),
        is_batch: false,
        quality,
        batch_episodes: []
      };
    }
  }
  
  return null;
}

/**
 * Fallback parsing for titles that don't match common patterns
 */
function fallbackParsing(title: string) {
  // Try to extract episode number with various patterns
  const episodePatterns = [
    // - 01 pattern
    /(.+?)[_.\s-]+(\d{1,3})(?:[_.\s-]+|$)(.*)/,
    // EP01 or E01 pattern
    /(.+?)[_.\s-]*(?:EP|E)(\d{1,3})(?:[_.\s-]+|$)(.*)/i,
    // Episode 01 pattern
    /(.+?)[_.\s-]*Episode[_.\s-]*(\d{1,3})(?:[_.\s-]+|$)(.*)/i,
  ];

  for (const pattern of episodePatterns) {
    const match = title.match(pattern);
    if (match) {
      const [, show, episode, rest] = match;
      
      // Extract quality
      let quality = "unknown";
      if (title.includes("1080p")) quality = "1080p";
      else if (title.includes("720p")) quality = "720p";
      else if (title.includes("480p")) quality = "480p";
      
      // Check for batch indicators
      const isBatch = /\b(?:batch|complete|season|vol|volume)\b/i.test(title);
      
      // Try to extract batch episodes
      let batchEpisodes: number[] = [];
      if (isBatch) {
        const batchMatch = title.match(/\b(\d{1,2})-(\d{1,2})\b/);
        if (batchMatch) {
          const start = parseInt(batchMatch[1], 10);
          const end = parseInt(batchMatch[2], 10);
          if (start < end && end - start < 50) { // Sanity check
            batchEpisodes = Array.from({ length: end - start + 1 }, (_, i) => start + i);
          }
        }
      }
      
      return {
        show: show.trim(),
        season: 1, // Default to season 1
        episode: parseInt(episode, 10),
        is_batch: isBatch,
        quality,
        batch_episodes: batchEpisodes
      };
    }
  }
  
  return null;
}

/**
 * Checks if a parsed torrent title matches the target episode
 */
export async function isValidEpisode(
  showTitle: string, 
  targetSeason: number, 
  targetEpisode: number, 
  parsed: any
): Promise<boolean> {
  // First try direct episode match
  const directMatch = await directEpisodeMatch(targetSeason, targetEpisode, parsed);
  if (directMatch) {
    return true;
  }
  
  await logInfo(`Direct match failed: ${JSON.stringify(parsed)}`, true);
  
  // If it's a batch, check if the target episode is in the batch
  if (parsed.is_batch && Array.isArray(parsed.batch_episodes)) {
    return parsed.batch_episodes.includes(targetEpisode);
  }
  
  // Compare show names
  const normalizedShowTitle = normalizeShowName(showTitle);
  const normalizedParsedShow = normalizeShowName(parsed.show);
  
  // Check if the parsed show name is similar to the target show name
  const showNameMatch = 
    normalizedParsedShow.includes(normalizedShowTitle) || 
    normalizedShowTitle.includes(normalizedParsedShow);
  
  if (!showNameMatch) {
    return false;
  }
  
  // If we get here, the show name matches but the episode doesn't
  // This could be due to absolute vs. season-based episode numbering
  // Let's be a bit more lenient and accept it if the season matches
  return parsed.season === targetSeason;
}

/**
 * Checks if a parsed torrent title directly matches the target episode
 */
async function directEpisodeMatch(
  targetSeason: number, 
  targetEpisode: number, 
  parsed: any
): Promise<boolean> {
  // Check if the parsed data has the required fields
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }
  
  // Check if the season and episode match exactly
  if (parsed.season === targetSeason && parsed.episode === targetEpisode) {
    return true;
  }
  
  return false;
} 