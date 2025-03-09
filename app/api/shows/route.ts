import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { showsTable, episodesTable } from '@/db/schema';

/**
 * @api {get} /api/shows Get all shows
 * @apiDescription Retrieves a list of all anime shows in the database
 * @apiName GetShows
 * @apiGroup Shows
 * 
 * @apiSuccess {Object[]} shows List of show objects
 * @apiSuccess {Number} shows.id Show ID
 * @apiSuccess {String} shows.title Show title
 * @apiSuccess {String} [shows.alternateNames] Alternate names for the show
 * @apiSuccess {Number} [shows.startSeason] Starting season to track
 * @apiSuccess {Number} [shows.startEpisode] Starting episode to track
 * @apiSuccess {Number} [shows.endSeason] Ending season to track
 * @apiSuccess {Number} [shows.endEpisode] Ending episode to track
 * @apiSuccess {String} [shows.episodesPerSeason] JSON string of episodes per season
 * @apiSuccess {String} [shows.quality] Preferred quality
 * @apiSuccess {String} shows.status Show status (ongoing, completed, paused)
 * @apiSuccess {String} [shows.lastScanned] Timestamp of last scan
 * 
 * @apiError {Object} error Error object
 * @apiError {String} error.error Error message
 */
export async function GET() {
  try {
    const shows = await db.select().from(showsTable);
    return NextResponse.json(shows);
  } catch (error) {
    console.error('Error fetching shows:', error);
    return NextResponse.json({ error: 'Failed to fetch shows' }, { status: 500 });
  }
}

/**
 * @api {post} /api/shows Create a new show
 * @apiDescription Creates a new anime show in the database
 * @apiName CreateShow
 * @apiGroup Shows
 * 
 * @apiBody {String} title Show title
 * @apiBody {String} [alternateNames] Alternate names for the show
 * @apiBody {Number} [startSeason] Starting season to track
 * @apiBody {Number} [startEpisode] Starting episode to track
 * @apiBody {Number} [endSeason] Ending season to track
 * @apiBody {Number} [endEpisode] Ending episode to track
 * @apiBody {String} [episodesPerSeason] JSON string of episodes per season
 * @apiBody {String} [quality] Preferred quality
 * @apiBody {String} status Show status (ongoing, completed, paused)
 * 
 * @apiSuccess {Object} show Created show object
 * @apiSuccess {Number} show.id Show ID
 * 
 * @apiError {Object} error Error object
 * @apiError {String} error.error Error message
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      alternateNames,
      startSeason,
      startEpisode,
      endSeason,
      endEpisode,
      episodesPerSeason,
      quality,
      status,
    } = body;

    // Create the show
    const newShow = await db
      .insert(showsTable)
      .values({
        title,
        alternateNames,
        startSeason,
        startEpisode,
        endSeason,
        endEpisode,
        episodesPerSeason,
        quality,
        status,
      })
      .returning();

    const showId = newShow[0].id;

    // Calculate total episodes based on episodesPerSeason
    let totalEpisodes = 0;
    try {
      // Try to parse episodesPerSeason as JSON array
      const episodesArray = JSON.parse(episodesPerSeason);
      if (Array.isArray(episodesArray)) {
        // We have a different number for each season
        // We need to make sure we have enough entries for all seasons
        const seasons = endSeason - startSeason + 1;

        // Sum up the episodes for all relevant seasons
        for (let i = 0; i < seasons; i++) {
          // If we have data for this season, use it, otherwise use the last available value or default to 12
          const episodeCount =
            i < episodesArray.length
              ? episodesArray[i]
              : episodesArray.length > 0
                ? episodesArray[episodesArray.length - 1]
                : 12;

          totalEpisodes += episodeCount;
        }
      } else {
        // Not an array, should be a number
        const singleValue = parseInt(episodesPerSeason) || 12;
        totalEpisodes = singleValue * (endSeason - startSeason + 1);
      }
    } catch (e) {
      // Not valid JSON, assume it's a simple number string
      const defaultEpisodes = parseInt(episodesPerSeason) || 12;
      totalEpisodes = defaultEpisodes * (endSeason - startSeason + 1);
    }

    // Create episode entries for the show (all marked as not downloaded initially)
    const episodeEntries = [];

    for (let i = 1; i <= totalEpisodes; i++) {
      episodeEntries.push({
        showId,
        episodeNumber: i,
        isDownloaded: false,
        magnetLink: null,
      });
    }

    if (episodeEntries.length > 0) {
      await db.insert(episodesTable).values(episodeEntries);
    }

    return NextResponse.json(newShow[0]);
  } catch (error) {
    console.error('Error creating show:', error);
    return NextResponse.json({ error: 'Failed to create show' }, { status: 500 });
  }
}
