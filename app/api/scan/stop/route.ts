import { NextResponse } from 'next/server';
import { getScanState, updateScanState } from '@/app/services/scanService';
import { logInfo } from '@/app/utils/logging';
import { 
  successResponse, 
  errorResponse, 
  withErrorHandling 
} from '@/app/utils/api/responseHandler';

/**
 * POST endpoint to stop a scan
 */
export async function POST() {
  return withErrorHandling(async () => {
    await logInfo('POST /api/scan/stop - Stopping scan');
    
    // Get the current scan state
    const scanState = await getScanState();
    
    // Check if a scan is in progress
    if (!scanState.isScanning) {
      return errorResponse('No scan is currently in progress', 400);
    }
    
    // Update scan state to idle
    await updateScanState(false, 'Scan stopped by user', null);
    
    return successResponse({ isScanning: false }, 'Scan stopped successfully');
  }, 'Failed to stop scan');
} 