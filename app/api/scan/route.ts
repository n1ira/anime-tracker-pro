import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { scanStateTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const scanState = await db.select().from(scanStateTable).limit(1);
    
    if (scanState.length === 0) {
      // Initialize scan state if it doesn't exist
      const newScanState = await db.insert(scanStateTable).values({
        isScanning: false,
        status: 'idle',
      }).returning();
      
      return NextResponse.json(newScanState[0]);
    }
    
    return NextResponse.json(scanState[0]);
  } catch (error) {
    console.error('Error fetching scan state:', error);
    return NextResponse.json({ error: 'Failed to fetch scan state' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { isScanning, currentShowId, status } = body;
    
    // Get the current scan state
    const currentState = await db.select().from(scanStateTable).limit(1);
    
    if (currentState.length === 0) {
      // Initialize scan state if it doesn't exist
      const newScanState = await db.insert(scanStateTable).values({
        isScanning,
        currentShowId,
        status,
        startedAt: isScanning ? new Date() : null,
      }).returning();
      
      return NextResponse.json(newScanState[0]);
    }
    
    // Update existing scan state
    const updatedState = await db.update(scanStateTable)
      .set({
        isScanning,
        currentShowId,
        status,
        startedAt: isScanning && !currentState[0].isScanning ? new Date() : currentState[0].startedAt,
      })
      .where(eq(scanStateTable.id, currentState[0].id))
      .returning();
    
    return NextResponse.json(updatedState[0]);
  } catch (error) {
    console.error('Error updating scan state:', error);
    return NextResponse.json({ error: 'Failed to update scan state' }, { status: 500 });
  }
} 