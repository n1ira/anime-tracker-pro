import { NextResponse } from 'next/server';
import { 
  initializeScanState, 
  getScanState, 
  updateScanState, 
  scanShow, 
  scanAllShows 
} from '@/app/services/scanService';
import { logInfo, logError } from '@/app/utils/logging';
import { 
  successResponse, 
  errorResponse, 
  handleApiError, 
  validateParams, 
  withErrorHandling 
} from '@/app/utils/api/responseHandler';

/**
 * GET endpoint to get the current scan state
 */
export async function GET() {
  return withErrorHandling(async () => {
    await logInfo('GET /api/scan - Getting scan state');
    
      // Initialize scan state if it doesn't exist
    await initializeScanState();
    
    // Get the current scan state
    const scanState = await getScanState();
    
    return successResponse(scanState, 'Scan state retrieved successfully');
  }, 'Failed to get scan state');
}

/**
 * POST endpoint to start a scan
 */
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    try {
      // Extract the request data
      const requestData = await request.json();
      
      // Handle old format parameters: {isScanning, currentShowId, status, action}
      // And map them to new format: {showId, origin}
      let showId = requestData.showId;
      const origin = request.headers.get('origin') || '';
      
      // If using old parameter format, map to new format
      if ('currentShowId' in requestData && 'action' in requestData) {
        // Map old format to new format
        showId = requestData.currentShowId || null;
        
        // If action is 'stop', use the stop endpoint instead
        if (requestData.action === 'stop') {
          // Redirect to the stop endpoint
          const response = await fetch(`${origin}/api/scan/stop`, {
            method: 'POST',
          });
          
          if (!response.ok) {
            return errorResponse('Failed to stop scan', 500);
          }
          
          const data = await response.json();
          return successResponse(data.data, data.message || 'Scan stopped successfully');
        }
      }
      
      // Log the request
      await logInfo(`POST /api/scan - Processing request: ${JSON.stringify({ showId, origin })}`);
      
      // Validate required parameters
      if (!origin) {
        return errorResponse('Missing required origin parameter', 400);
      }
      
      // Get the current scan state
      const scanState = await getScanState();
      
      // Check if a scan is already in progress
      if (scanState.isScanning) {
        return errorResponse('A scan is already in progress', 409);
      }
      
      // If showId is provided, scan a specific show
      if (showId) {
        await logInfo(`POST /api/scan - Starting scan for show ID: ${showId}`);
        
        // Update scan state to scanning
        await updateScanState(true, `Scanning show ID: ${showId}`, showId);
        
        // Start the scan in the background
        scanShow(showId, origin).catch(error => {
          logError(`Error scanning show: ${error}`);
          updateScanState(false, 'Error scanning show', null);
        });
        
        return successResponse({ isScanning: true, showId }, 'Scan started successfully');
      } else {
        // Scan all shows
        await logInfo('POST /api/scan - Starting scan for all shows');
        
        // Update scan state to scanning
        await updateScanState(true, 'Scanning all shows', null);
        
        // Start the scan in the background
        scanAllShows(origin).catch(error => {
          logError(`Error scanning all shows: ${error}`);
          updateScanState(false, 'Error scanning all shows', null);
        });
        
        return successResponse({ isScanning: true }, 'Scan started successfully');
      }
    } catch (error) {
      return await handleApiError(error, 'Failed to start scan');
    }
  }, 'Failed to start scan');
} 