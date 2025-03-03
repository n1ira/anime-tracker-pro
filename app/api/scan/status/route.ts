import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { scanStateTable, showsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    // Get the current scan state
    const scanState = await db.select().from(scanStateTable).limit(1);
    
    if (scanState.length === 0) {
      // Initialize scan state if it doesn't exist
      const newScanState = await db.insert(scanStateTable).values({
        isScanning: false,
        status: 'idle',
      }).returning();
      
      return NextResponse.json({
        ...newScanState[0],
        currentShow: null,
      });
    }
    
    // If there's a current show ID, get the show details
    let currentShow = null;
    if (scanState[0].currentShowId) {
      const show = await db.select().from(showsTable).where(eq(showsTable.id, scanState[0].currentShowId)).limit(1);
      if (show.length > 0) {
        currentShow = show[0];
      }
    }
    
    return NextResponse.json({
      ...scanState[0],
      currentShow,
    });
  } catch (error) {
    console.error('Error fetching scan status:', error);
    return NextResponse.json({ error: 'Failed to fetch scan status' }, { status: 500 });
  }
} 