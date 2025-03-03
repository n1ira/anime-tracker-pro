import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { scanStateTable, logsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    // Get the current scan state
    const currentState = await db.select().from(scanStateTable).limit(1);
    
    if (currentState.length === 0 || !currentState[0].isScanning) {
      // No scan in progress
      return NextResponse.json({ message: 'No scan in progress' });
    }
    
    // Update scan state to stop scanning
    const updatedState = await db.update(scanStateTable)
      .set({
        isScanning: false,
        status: 'stopped',
      })
      .where(eq(scanStateTable.id, currentState[0].id))
      .returning();
    
    // Log the stop action
    await db.insert(logsTable).values({
      message: 'Scan stopped by user',
      level: 'warning',
      createdAt: new Date(),
    });
    
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