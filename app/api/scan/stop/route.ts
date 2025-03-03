import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { scanStateTable, logsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    console.log('DEBUG: POST /api/scan/stop called');
    
    // Get the current scan state
    const currentState = await db.select().from(scanStateTable).limit(1);
    console.log('DEBUG: Current scan state:', JSON.stringify(currentState[0]));
    
    if (currentState.length === 0 || !currentState[0].isScanning) {
      // No scan in progress
      console.log('DEBUG: No scan in progress to stop');
      return NextResponse.json({ message: 'No scan in progress' });
    }
    
    // Update scan state to stop scanning
    const updatedState = await db.update(scanStateTable)
      .set({
        isScanning: false,
        status: 'stopped',
        currentShowId: null,
      })
      .where(eq(scanStateTable.id, currentState[0].id))
      .returning();
    
    console.log('DEBUG: Updated scan state to stopped:', JSON.stringify(updatedState[0]));
    
    // Log the stop action
    await db.insert(logsTable).values({
      message: 'Scan stopped by user',
      level: 'warning',
      createdAt: new Date(),
    });
    
    console.log('Scan state changed: isScanning = false, status = stopped');
    
    return NextResponse.json(updatedState[0]);
  } catch (error) {
    console.error('Error stopping scan:', error);
    
    // Log the error
    await db.insert(logsTable).values({
      message: `Error stopping scan: ${error}`,
      level: 'error',
      createdAt: new Date(),
    });
    
    return NextResponse.json({ error: 'Failed to stop scan' }, { status: 500 });
  }
} 