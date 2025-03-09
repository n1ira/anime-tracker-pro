import { NextResponse } from 'next/server';
import { 
  initializeScanState, 
  getScanState, 
  updateScanState, 
  stopScan, 
  scanShow, 
  scanAllShows 
} from '@/lib/services/scanService';
import { 
  successResponse, 
  errorResponse, 
  handleApiError 
} from '@/app/utils/api/responseHandler';
import { createLog } from '@/app/utils/logging';

/**
 * GET /api/scanner-new
 * Get the current scan state
 */
export async function GET() {
  try {
    await initializeScanState();
    const scanState = await getScanState();
    
    return successResponse(scanState || { isScanning: false, status: 'idle' });
  } catch (error) {
    return handleApiError(error, 'GET /api/scanner-new');
  }
}

/**
 * POST /api/scanner-new
 * Update the scan state or perform scan actions
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { isScanning, currentShowId, status, action, showId } = body;
    const origin = request.headers.get('origin') || '';
    
    console.log('DEBUG: POST /api/scanner-new received:', JSON.stringify(body));
    
    // If stopping a scan, immediately update the state to stop scanning
    if (action === 'stop') {
      const stoppedState = await stopScan('Scan stopped by user');
      await createLog('Scan stopped by user');
      return successResponse(stoppedState, 'Scan stopped successfully');
    }
    
    // If starting a scan for a specific show
    if (action === 'scan' && showId) {
      // Update scan state to indicate scanning
      const updatedState = await updateScanState({
        isScanning: true,
        status: 'Scanning show',
        currentShowId: showId,
      });
      
      // Start the scan in the background
      scanShow(showId, origin).catch(error => {
        console.error('Error in background scan:', error);
      });
      
      return successResponse(updatedState, 'Scan started successfully');
    }
    
    // If starting a scan for all shows
    if (action === 'scanAll') {
      // Update scan state to indicate scanning
      const updatedState = await updateScanState({
        isScanning: true,
        status: 'Starting scan for all shows',
        currentShowId: null,
      });
      
      // Start the scan in the background
      scanAllShows(origin).catch(error => {
        console.error('Error in background scan all:', error);
      });
      
      return successResponse(updatedState, 'Scan all shows started successfully');
    }
    
    // If just updating the scan state
    if (isScanning !== undefined || status || currentShowId !== undefined) {
      const updatedState = await updateScanState({
        isScanning: isScanning,
        status: status,
        currentShowId: currentShowId,
      });
      
      return successResponse(updatedState, 'Scan state updated successfully');
    }
    
    return errorResponse('Invalid action', 400);
  } catch (error) {
    return handleApiError(error, 'POST /api/scanner-new');
  }
} 