import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { logsTable } from '@/db/schema';
import { desc, gt } from 'drizzle-orm';

// Global variable to store connected clients
const clients = new Set<ReadableStreamController<Uint8Array>>();

// Function to send a message to all connected clients
export function sendSSEMessage(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      console.error('Error sending SSE message:', error);
    }
  });
}

// Poll for new logs and send them to clients
let lastLogId = 0;

// Initialize lastLogId with the highest log ID
async function initLastLogId() {
  try {
    const latestLog = await db.select()
      .from(logsTable)
      .orderBy(desc(logsTable.id))
      .limit(1);
    
    if (latestLog.length > 0) {
      lastLogId = latestLog[0].id;
      console.log(`Initialized lastLogId to ${lastLogId}`);
    }
  } catch (error) {
    console.error('Error initializing lastLogId:', error);
  }
}

// Poll for new logs every second
async function pollForNewLogs() {
  if (clients.size === 0) {
    // No clients connected, try again later
    setTimeout(pollForNewLogs, 1000);
    return;
  }

  try {
    const newLogs = await db.select()
      .from(logsTable)
      .where(gt(logsTable.id, lastLogId))
      .orderBy(desc(logsTable.id));
    
    if (newLogs.length > 0) {
      // Update lastLogId
      lastLogId = Math.max(lastLogId, ...newLogs.map(log => log.id));
      console.log(`Found ${newLogs.length} new logs, updated lastLogId to ${lastLogId}`);
      
      // Send each new log to SSE clients
      newLogs.forEach(log => {
        sendSSEMessage(log);
      });
    }
  } catch (error) {
    console.error('Error polling for new logs:', error);
  }
  
  // Schedule next poll
  setTimeout(pollForNewLogs, 1000);
}

// Initialize polling
initLastLogId().then(() => {
  pollForNewLogs();
  console.log('Started polling for new logs');
});

export async function GET() {
  // Create a new ReadableStream
  const stream = new ReadableStream({
    start(controller) {
      // Add this client to the set
      clients.add(controller);
      console.log(`Client connected. Total clients: ${clients.size}`);
      
      // Send initial message
      controller.enqueue(new TextEncoder().encode('data: {"message": "Connected to logs stream"}\n\n'));
      
      // Remove client when connection is closed
      return () => {
        clients.delete(controller);
        console.log(`Client disconnected. Total clients: ${clients.size}`);
      };
    },
    cancel() {
      // Remove this client from the set when the connection is closed
      clients.forEach(client => {
        if (client.desiredSize === null) {
          clients.delete(client);
        }
      });
      console.log(`Client cancelled. Total clients: ${clients.size}`);
    }
  });

  // Return the stream as a response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 