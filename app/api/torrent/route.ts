import { NextResponse } from 'next/server';
import { searchTorrents } from '@/app/services/torrentService';
import { logInfo } from '@/app/utils/logging';
import { 
  successResponse, 
  errorResponse, 
  withErrorHandling, 
  validateParams 
} from '@/app/utils/api/responseHandler';

/**
 * POST endpoint to search for torrents for a specific episode
 */
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    try {
      const { showId, season, episode } = await request.json();
      
      // Validate required parameters
      const validation = validateParams({ showId, season, episode }, ['showId', 'season', 'episode']);
      if (!validation.valid) {
        return errorResponse(`Missing required parameters: ${validation.missing?.join(', ')}`, 400);
      }
      
      await logInfo(`POST /api/torrent - Searching for show ID: ${showId}, S${season}E${episode}`);
      
      // Search for torrents
      const result = await searchTorrents(showId, season, episode);
      
      if (!result.success) {
        return errorResponse(result.message || 'No matches found', 404);
      }
      
      return successResponse(result, 'Torrent search successful');
      } catch (error) {
      return errorResponse('Failed to search for torrents', 500);
    }
  }, 'Failed to search for torrents');
} 