import { NextResponse } from 'next/server';
import { testSearch } from '@/app/services/torrentService';
import { logInfo } from '@/app/utils/logging';
import { 
  successResponse, 
  errorResponse, 
  withErrorHandling 
} from '@/app/utils/api/responseHandler';

/**
 * GET endpoint to test torrent search with a specific query
 */
export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || 'Solo Leveling S01E21';

    await logInfo(`GET /api/torrent/test - Testing search with query: ${query}`);
    
    // Test search with the query
    const result = await testSearch(query);
    
    if ('error' in result) {
      return errorResponse(result.error || 'Failed to search for torrents', 500);
    }
    
    return successResponse(result, 'Torrent test search successful');
  }, 'Failed to test torrent search');
} 