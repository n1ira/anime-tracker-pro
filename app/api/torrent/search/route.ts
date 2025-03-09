import { NextResponse } from 'next/server';
import { searchTorrents } from '@/app/services/torrentService';
import { logInfo } from '@/app/utils/logging';
import {
  successResponse,
  errorResponse,
  withErrorHandling,
  validateParams,
} from '@/app/utils/api/responseHandler';

/**
 * GET endpoint to search for torrents for a specific episode
 */
export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    const season = searchParams.get('season');
    const episode = searchParams.get('episode');

    // Validate required parameters
    const validation = validateParams(
      {
        showId: showId ? parseInt(showId, 10) : null,
        season: season ? parseInt(season, 10) : null,
        episode: episode ? parseInt(episode, 10) : null,
      },
      ['showId', 'season', 'episode']
    );

    if (!validation.valid) {
      return errorResponse(`Missing required parameters: ${validation.missing?.join(', ')}`, 400);
    }

    await logInfo(
      `GET /api/torrent/search - Searching for show ID: ${showId}, S${season}E${episode}`
    );

    // Search for torrents
    const result = await searchTorrents(
      parseInt(showId!, 10),
      parseInt(season!, 10),
      parseInt(episode!, 10)
    );

    if (!result.success) {
      return errorResponse(result.message || 'No matches found', 404);
    }

    return successResponse(result, 'Torrent search successful');
  }, 'Failed to search for torrents');
}
