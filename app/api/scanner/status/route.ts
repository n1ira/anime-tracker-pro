import { NextResponse } from 'next/server';

// This endpoint simply proxies to the existing scan/status endpoint
export async function GET() {
  try {
    // Fetch the scan status from the existing endpoint
    const scanStatusResponse = await fetch('http://localhost:3000/api/scan/status');

    if (!scanStatusResponse.ok) {
      console.error(
        'Error fetching from scan/status:',
        scanStatusResponse.status,
        scanStatusResponse.statusText
      );
      return NextResponse.json(
        {
          scanning: false,
          error: 'Failed to fetch scanner status',
        },
        { status: 500 }
      );
    }

    const scanStatus = await scanStatusResponse.json();

    // Return a simplified version with just the scanning state
    return NextResponse.json({
      scanning: scanStatus.isScanning || false,
      status: scanStatus.status || 'idle',
      currentShowId: scanStatus.currentShowId || null,
    });
  } catch (error) {
    console.error('Error in scanner/status endpoint:', error);
    return NextResponse.json(
      {
        scanning: false,
        error: 'An error occurred while checking scanner status',
      },
      { status: 500 }
    );
  }
}
