import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { logsTable } from '@/db/schema';
import { desc, gt, asc } from 'drizzle-orm';
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

// Function to send SSE message to all clients
export function sendSSEMessage(data: any) {
  if (!clients.size) {
    return;
  }
  
  let staleClients = 0;
  
  // Encode the data as an SSE message
  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);
  
  // Send to all clients
  clients.forEach((clientRef) => {
    try {
      const controller = clientRef.deref();
      if (controller) {
        controller.enqueue(encoded);
      } else {
        staleClients++;
      }
    } catch (error) {
      console.error('Error sending SSE message to client:', error);
      staleClients++;
    }
  });
  
  // Log message sent
  console.log(`Successfully sent SSE message to ${clients.size - staleClients} clients`);
  
  // If we have stale clients, schedule a cleanup
  if (staleClients > 0 && !cleanupTimeoutRef) {
    cleanupTimeoutRef = setTimeout(cleanupStaleClients, 0);
  }
  
  // Return the message for testing/debugging
  return message;
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
  if (isPolling) return;
  isPolling = true;
  
  try {
    // Query for new logs since the last one we saw
    const newLogs = await db.select()
      .from(logsTable)
      .where(gt(logsTable.id, lastLogId))
      .orderBy(asc(logsTable.id));
    
    if (newLogs.length > 0) {
      // Update the last log ID
      lastLogId = newLogs[newLogs.length - 1].id;
      console.log(`Fetched ${newLogs.length} new logs. Updated lastLogId to ${lastLogId}`);
      
      // Dynamically import the summarizeLogs function to avoid circular imports
      const { summarizeLogs } = await import('../route');
      
      // Generate summaries from the new logs
      let summaryData: any[] = [];
      try {
        summaryData = summarizeLogs(newLogs);
      } catch (error) {
        console.error('Error generating summaries:', error);
      }
      
      // Send logs and summaries to clients
      if (clients.size > 0) {
        // If we have too many logs, handle them in batches
        if (newLogs.length > 10) {
          // First send just the summaries
          sendSSEMessage({
            type: 'summaries_update',
            summaries: summaryData
          });
          
          // Then send logs in smaller batches
          const batchSize = 5;
          for (let i = 0; i < newLogs.length; i += batchSize) {
            const batch = newLogs.slice(i, i + batchSize);
            sendSSEMessage({ 
              type: 'logs_update',
              logs: batch,
              // Only include summaries in the first batch to avoid duplication
              summaries: [] 
            });
          }
        } else {
          // For smaller batches, send everything together
          sendSSEMessage({
            type: 'logs_update',
            logs: newLogs,
            summaries: summaryData
          });
        }
      }
    } else {
      // Even if there are no new logs, refresh the summaries periodically
      // This ensures that summaries don't disappear after a scan is complete
      try {
        // Get recent logs to generate summaries
        const recentLogs = await db.select()
          .from(logsTable)
          .orderBy(desc(logsTable.createdAt))
          .limit(100);
        
        // Dynamically import the summarizeLogs function
        const { summarizeLogs } = await import('../route');
        
        // Generate summaries from recent logs
        const summaryData = summarizeLogs(recentLogs);
        
        // Only send if there are summaries and clients
        if (summaryData.length > 0 && clients.size > 0) {
          sendSSEMessage({
            type: 'summaries_update',
            summaries: summaryData
          });
        }
      } catch (error) {
        console.error('Error refreshing summaries:', error);
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

// Utility to send message to all connected clients
const sendMessageToClients = async (recentLogs = []) => {
  if (sendSSEMessage) {
    // If we have no recent logs, just return
    if (recentLogs.length === 0) {
      return;
    }

    // Import summarizeLogs dynamically to avoid circular imports
    const { summarizeLogs } = await import('../route');
    
    // Create summaries from the recent logs
    let summaryData: any[] = [];
    try {
      summaryData = summarizeLogs(recentLogs);
    } catch (error) {
      console.error('Error generating summaries:', error);
    }
    
    // If we have too many logs, don't send them all at once to avoid large payloads
    // Instead, send the summaries with an empty logs array
    if (recentLogs.length > 10) {
      sendSSEMessage({ 
        type: 'summaries_update',
        summaries: summaryData
      });
      
      // Then send logs in smaller batches
      const batchSize = 5;
      for (let i = 0; i < recentLogs.length; i += batchSize) {
        const batch = recentLogs.slice(i, i + batchSize);
        sendSSEMessage({ 
          type: 'logs_update',
          logs: batch,
          summaries: i === 0 ? summaryData : [] // Only include summaries in the first batch
        });
      }
    } else {
      // For small log batches, send everything together
      sendSSEMessage({ 
        type: 'logs_update',
        logs: recentLogs,
        summaries: summaryData
      });
    }
  }
}; 