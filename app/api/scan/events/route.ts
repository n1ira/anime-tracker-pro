import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { logsTable } from '@/db/schema';
import { desc } from 'drizzle-orm';

// Global event emitter for scan events
export const scanEventEmitter = new EventTarget();

// Function to emit an event
export function emitScanEvent(eventName: string, data: any) {
  const event = new CustomEvent(eventName, { detail: data });
  scanEventEmitter.dispatchEvent(event);
}

// Map to store active connections
const clients = new Map();

export async function GET() {
  const encoder = new TextEncoder();
  const responseStream = new ReadableStream({
    start(controller) {
      // Generate a unique client ID
      const clientId = Date.now().toString();
      
      // Function to send events to this client
      const sendEvent = (eventName: string, data: any) => {
        try {
          // Check if controller is still active before sending
          if (controller.desiredSize === null) {
            // Controller is closed, don't send and clean up
            if (clients.has(clientId)) {
              const cleanup = clients.get(clientId);
              if (typeof cleanup === 'function') {
                cleanup();
              }
              clients.delete(clientId);
            }
            return;
          }
          
          const eventString = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(eventString));
        } catch (error) {
          console.error(`Error sending event to client ${clientId}:`, error);
          // Clean up this client if there's an error
          if (clients.has(clientId)) {
            const cleanup = clients.get(clientId);
            if (typeof cleanup === 'function') {
              cleanup();
            }
            clients.delete(clientId);
          }
        }
      };
      
      // Event listener for log events
      const logListener = async () => {
        try {
          // Get the latest log entry
          const logs = await db.select()
            .from(logsTable)
            .orderBy(desc(logsTable.createdAt))
            .limit(1);
          
          if (logs.length > 0) {
            const log = logs[0];
            
            // Check if this is an episode found log
            if (log.level === 'success' && log.message.includes('Match Found:')) {
              // Extract show ID, season, and episode from the log message if possible
              // This is a simplified example - you might need more complex parsing
              const match = log.message.match(/for (\d+) S(\d+)E(\d+)/);
              if (match) {
                const [, showId, season, episode] = match.map(Number);
                sendEvent('episodeFound', { showId, season, episode });
              }
            }
            
            // Send the log event
            sendEvent('log', log);
          }
        } catch (error) {
          console.error('Error fetching logs:', error);
        }
      };
      
      // Set up interval to check for new logs
      const intervalId = setInterval(logListener, 2000);
      
      // Store the client's cleanup function
      clients.set(clientId, () => {
        clearInterval(intervalId);
        clients.delete(clientId);
        console.log(`Client ${clientId} disconnected, cleanup complete`);
      });
      
      // Send initial connection event
      sendEvent('connected', { message: 'Connected to scan events' });
      
      console.log(`Client ${clientId} connected to scan events. Total clients: ${clients.size}`);
    },
    cancel() {
      // This will be called when the client disconnects
      // We don't have access to the clientId here, so we can't do specific cleanup
      // The clients will be cleaned up when the server restarts or by a cleanup routine
      console.log('Client disconnected from scan events');
    }
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
} 