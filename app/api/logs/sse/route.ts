import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { logsTable } from '@/db/schema';
import { desc, gt } from 'drizzle-orm';
import { setSendSSEMessage } from '../route';

// Use WeakRef for better garbage collection
export const clients = new Set<WeakRef<ReadableStreamController<Uint8Array>>>();

// Track client connection times to detect stale connections
const clientConnectTimes = new Map<WeakRef<ReadableStreamController<Uint8Array>>, number>();

// Maximum client connection time (5 minutes - reduced from 15 to prevent long-lived connections)
const MAX_CONNECTION_TIME = 5 * 60 * 1000;

// Polling interval in milliseconds
const POLLING_INTERVAL = 1000;

// Active polling timeout reference
let pollingTimeoutRef: NodeJS.Timeout | null = null;
let cleanupTimeoutRef: NodeJS.Timeout | null = null;

// Function to clean up stale clients
function cleanupStaleClients() {
  if (cleanupTimeoutRef) {
    clearTimeout(cleanupTimeoutRef);
    cleanupTimeoutRef = null;
  }
  
  const now = Date.now();
  const clientsToRemove = new Set<WeakRef<ReadableStreamController<Uint8Array>>>();
  
  clients.forEach(clientRef => {
    try {
      const client = clientRef.deref();
      // If the client is garbage collected or closed
      if (!client || client.desiredSize === null) {
        clientsToRemove.add(clientRef);
      } else {
        // Check if connection has been open too long
        const connectTime = clientConnectTimes.get(clientRef);
        if (connectTime && (now - connectTime > MAX_CONNECTION_TIME)) {
          console.log('Closing client connection that has been open for too long');
          clientsToRemove.add(clientRef);
          try {
            client.close();
          } catch (error) {
            console.error('Error closing stale client:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error checking client status during cleanup:', error);
      clientsToRemove.add(clientRef);
    }
  });
  
  // Remove stale clients
  let removedCount = 0;
  clientsToRemove.forEach(clientRef => {
    clients.delete(clientRef);
    clientConnectTimes.delete(clientRef);
    removedCount++;
  });
  
  if (removedCount > 0) {
    console.log(`Cleanup: Removed ${removedCount} stale clients. Total clients: ${clients.size}`);
  }
  
  // Only schedule next cleanup if we have clients
  if (clients.size > 0) {
    cleanupTimeoutRef = setTimeout(cleanupStaleClients, 10000); // Run every 10 seconds
  }
}

// Function to send a message to all connected clients
export function sendSSEMessage(data: any) {
  // If no clients, just return early
  if (clients.size === 0) {
    return;
  }
  
  try {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    const encodedMessage = new TextEncoder().encode(message);
    const failedClients = new Set<WeakRef<ReadableStreamController<Uint8Array>>>();
    let successCount = 0;
    
    clients.forEach(clientRef => {
      try {
        const client = clientRef.deref();
        // Only send to clients that are still alive and open
        if (client && client.desiredSize !== null) {
          client.enqueue(encodedMessage);
          successCount++;
        } else {
          failedClients.add(clientRef);
        }
      } catch (error) {
        console.error('Error sending SSE message:', error);
        failedClients.add(clientRef);
      }
    });
    
    // Remove failed clients
    if (failedClients.size > 0) {
      failedClients.forEach(clientRef => {
        clients.delete(clientRef);
        clientConnectTimes.delete(clientRef);
      });
      console.log(`Removed ${failedClients.size} failed clients. Total clients: ${clients.size}`);
    }
    
    if (successCount > 0) {
      console.log(`Successfully sent SSE message to ${successCount} clients`);
    }
    
    // If we have no more clients, stop polling
    if (clients.size === 0 && pollingTimeoutRef) {
      clearTimeout(pollingTimeoutRef);
      pollingTimeoutRef = null;
      isPolling = false;
      console.log('Stopped polling as there are no more clients');
    }
  } catch (error) {
    console.error('Error in sendSSEMessage:', error);
  }
}

// Set the sendSSEMessage function in the logs route
setSendSSEMessage(sendSSEMessage);

// Poll for new logs and send them to clients
let lastLogId = 0;
let isPolling = false;

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

// Poll for new logs
async function pollForNewLogs() {
  // Clear any existing timeout
  if (pollingTimeoutRef) {
    clearTimeout(pollingTimeoutRef);
    pollingTimeoutRef = null;
  }
  
  // Set flag to prevent multiple polling loops
  if (isPolling) return;
  isPolling = true;
  
  try {
    // Only poll if we have clients
    if (clients.size === 0) {
      isPolling = false;
      return;
    }

    // Get new logs since the last check
    const newLogs = await db.select()
      .from(logsTable)
      .where(gt(logsTable.id, lastLogId))
      .orderBy(desc(logsTable.id))
      .limit(20); // Reduced from 50 to 20 to prevent memory issues
    
    if (newLogs.length > 0) {
      // Update lastLogId
      lastLogId = Math.max(lastLogId, ...newLogs.map(log => log.id));
      
      // Send logs to clients
      if (clients.size > 0) {
        sendSSEMessage({ type: 'logs_update', logs: newLogs });
      }
    }
  } catch (error) {
    console.error('Error polling for new logs:', error);
  } finally {
    // Reset polling flag and schedule next poll only if we have clients
    isPolling = false;
    if (clients.size > 0) {
      pollingTimeoutRef = setTimeout(pollForNewLogs, POLLING_INTERVAL);
    }
  }
}

// Initialize polling
let pollingInitialized = false;

export async function GET() {
  // Initialize polling only once
  if (!pollingInitialized) {
    await initLastLogId();
    pollingInitialized = true;
  }

  // Create a new ReadableStream
  const stream = new ReadableStream({
    start(controller) {
      try {
        // Add this client to the set using WeakRef
        const clientRef = new WeakRef(controller);
        clients.add(clientRef);
        clientConnectTimes.set(clientRef, Date.now());
        console.log(`Client connected. Total clients: ${clients.size}`);
        
        // Send initial message
        controller.enqueue(new TextEncoder().encode('data: {"message": "Connected to logs stream"}\n\n'));
        
        // Start polling if not already polling
        if (!isPolling && !pollingTimeoutRef) {
          pollingTimeoutRef = setTimeout(pollForNewLogs, 0);
          console.log('Started polling for new logs');
        }
        
        // Start cleanup if not already running
        if (!cleanupTimeoutRef) {
          cleanupTimeoutRef = setTimeout(cleanupStaleClients, 10000);
        }
      } catch (error) {
        console.error('Error in SSE start handler:', error);
      }
    },
    cancel() {
      try {
        // We can't directly remove this client since we don't have a reference to the WeakRef
        // The cleanup process will handle removing stale clients
        console.log(`Client disconnected. Total clients: ${clients.size}`);
        
        // Force a cleanup to remove this client
        cleanupStaleClients();
      } catch (error) {
        console.error('Error in SSE cancel handler:', error);
      }
    }
  });

  // Return the stream with appropriate headers
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
} 