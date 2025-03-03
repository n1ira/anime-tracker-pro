import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { logsTable } from '@/db/schema';
import { desc } from 'drizzle-orm';

// Import sendSSEMessage dynamically to avoid circular dependencies
// We'll use a function that will be set from the outside
let _sendSSEMessage: ((data: any) => void) | null = null;

// Function to set the SSE message sender from outside
export function setSendSSEMessage(fn: (data: any) => void) {
  _sendSSEMessage = fn;
  console.log('SSE message sender function has been set');
}

export async function GET(request: Request) {
  try {
    // Get URL parameters for pagination
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // Validate and cap limit to prevent excessive memory usage
    const validLimit = Math.min(Math.max(1, limit), 100);
    const validOffset = Math.max(0, offset);
    
    const logs = await db.select()
      .from(logsTable)
      .orderBy(desc(logsTable.createdAt))
      .limit(validLimit)
      .offset(validOffset);
    
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    console.log('Clearing all logs...');
    
    // Delete all logs
    await db.delete(logsTable);
    console.log('All logs deleted from database');
    
    // Create a new log entry to indicate logs were cleared
    let newLog = null;
    try {
      newLog = await db.insert(logsTable).values({
        message: 'All logs have been cleared',
        level: 'info',
        createdAt: new Date(),
      }).returning();
      console.log('Created new log entry after clearing logs');
    } catch (logError) {
      console.error('Error creating log entry after clearing logs:', logError);
    }
    
    // Return success response
    const response = NextResponse.json({ message: 'Logs cleared successfully' });
    
    // Send the new log to SSE clients in a non-blocking way
    if (newLog && newLog.length > 0) {
      sendSafeSSEMessage(newLog[0]);
    }
    
    return response;
  } catch (error) {
    console.error('Error clearing logs:', error);
    return NextResponse.json({ 
      error: 'Failed to clear logs',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Helper function to safely send SSE messages
function sendSafeSSEMessage(data: any) {
  // Use setTimeout to make this non-blocking
  setTimeout(() => {
    try {
      if (_sendSSEMessage) {
        _sendSSEMessage(data);
      }
    } catch (error) {
      console.error('Error in sendSafeSSEMessage:', error);
      // Reset the function if it's causing errors
      _sendSSEMessage = null;
    }
  }, 0);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { level, message } = body;
    
    if (!level || !message) {
      return NextResponse.json({ error: 'Level and message are required' }, { status: 400 });
    }
    
    const newLog = await db.insert(logsTable).values({
      level,
      message,
      createdAt: new Date(),
    }).returning();
    
    // Send the new log to all connected clients
    if (newLog && newLog.length > 0) {
      sendSafeSSEMessage(newLog[0]);
    }
    
    return NextResponse.json(newLog[0]);
  } catch (error) {
    console.error('Error creating log:', error);
    return NextResponse.json({ error: 'Failed to create log' }, { status: 500 });
  }
} 