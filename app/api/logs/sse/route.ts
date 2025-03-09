import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { logsTable } from '@/db/schema';
import { desc, gt, asc } from 'drizzle-orm';
import { setSendSSEMessage } from '../route';

// Use WeakRef for better garbage collection
const clients = new Set<WeakRef<ReadableStreamController<Uint8Array>>>();

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
  const initialClientCount = clients.size;

  clients.forEach(clientRef => {
    try {
      const client = clientRef.deref();
      // If the client is garbage collected or closed
      if (!client || client.desiredSize === null) {
        clientsToRemove.add(clientRef);
      } else {
        // Check if connection has been open too long
        const connectTime = clientConnectTimes.get(clientRef);
        if (connectTime && now - connectTime > MAX_CONNECTION_TIME) {
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
    if (clients.delete(clientRef)) {
      removedCount++;
    }
    clientConnectTimes.delete(clientRef);
  });

  // Log cleanup results if any clients were removed
  if (removedCount > 0) {
    console.log(
      `Cleaned up ${removedCount} stale clients. Clients before: ${initialClientCount}, after: ${clients.size}`
    );
  }

  // Schedule next cleanup if we still have clients
  if (clients.size > 0) {
    cleanupTimeoutRef = setTimeout(cleanupStaleClients, 30000); // Run cleanup every 30 seconds
  }
}

// Function to send SSE message to all clients
function sendSSEMessage(data: any) {
  // Early return if no clients
  if (clients.size === 0) {
    console.log('No clients connected, skipping message send');
    return null;
  }

  let activeClients = 0;
  const clientsToRemove = new Set<WeakRef<ReadableStreamController<Uint8Array>>>();

  // Encode the data as an SSE message
  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);

  // Send to all clients
  clients.forEach(clientRef => {
    try {
      const controller = clientRef.deref();
      // If the controller has been garbage collected or is closed, mark for removal
      if (!controller || controller.desiredSize === null) {
        clientsToRemove.add(clientRef);
        return;
      }

      // Extra check - try to access desiredSize which will throw if controller is closed
      try {
        // This will throw if the controller is already closed
        const size = controller.desiredSize;
        if (size === null) {
          clientsToRemove.add(clientRef);
          return;
        }
      } catch (err) {
        // If accessing desiredSize throws, the controller is in an invalid state
        clientsToRemove.add(clientRef);
        return;
      }

      // If we got here, the controller should be valid
      try {
        controller.enqueue(encoded);
        activeClients++; // Count only successful sends
      } catch (err) {
        console.error('Error enqueueing message:', err);
        clientsToRemove.add(clientRef);
      }
    } catch (error) {
      console.error('Error sending SSE message to client:', error);
      clientsToRemove.add(clientRef);
    }
  });

  // Remove any stale clients we found during this operation
  if (clientsToRemove.size > 0) {
    clientsToRemove.forEach(ref => {
      clients.delete(ref);
      clientConnectTimes.delete(ref);
    });

    console.log(
      `Removed ${clientsToRemove.size} stale clients. Remaining clients: ${clients.size}`
    );
  }

  // Log message sent - use activeClients for accuracy
  if (activeClients > 0) {
    console.log(`Successfully sent SSE message to ${activeClients} clients`);
  } else if (clientsToRemove.size > 0) {
    console.log(`No active clients found. Removed ${clientsToRemove.size} stale clients.`);
  }

  // If we have stale clients, schedule a cleanup
  if (clientsToRemove.size > 0 && !cleanupTimeoutRef) {
    cleanupTimeoutRef = setTimeout(cleanupStaleClients, 0);
  }

  // Return the message for testing/debugging
  return message;
}

// Set the sendSSEMessage function in the logs route
setSendSSEMessage(sendSSEMessage);

// Export a function to allow other modules to send SSE messages
export function sendSSEMessageToClients(data: any) {
  return sendSSEMessage(data);
}

// Poll for new logs and send them to clients
let lastLogId = 0;
let isPolling = false;

// Initialize lastLogId with the highest log ID
async function initLastLogId() {
  try {
    const latestLog = await db.select().from(logsTable).orderBy(desc(logsTable.id)).limit(1);

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
  // First, check if we have any clients to send to
  if (clients.size === 0) {
    console.log('No clients connected, pausing polling');
    pollingTimeoutRef = null;
    isPolling = false;
    return;
  }

  // Check if already polling
  if (isPolling) return;
  isPolling = true;

  try {
    // Run a cleanup first to ensure we have accurate client count
    // This will remove any stale clients before we try to send messages
    await new Promise<void>(resolve => {
      cleanupStaleClients();
      resolve();
    });

    // After cleanup, check again if we have clients
    if (clients.size === 0) {
      console.log('No clients left after polling, stopping polling cycle');
      pollingTimeoutRef = null;
      isPolling = false;
      return;
    }

    // Query for new logs since the last one we saw
    const newLogs = await db
      .select()
      .from(logsTable)
      .where(gt(logsTable.id, lastLogId))
      .orderBy(asc(logsTable.id));

    if (newLogs.length > 0) {
      // Update the last log ID
      lastLogId = newLogs[newLogs.length - 1].id;
      console.log(`Fetched ${newLogs.length} new logs. Updated lastLogId to ${lastLogId}`);

      try {
        // Dynamically import the summarizeLogs function to avoid circular imports
        const { summarizeLogs } = await import('../route');

        // Generate summaries from the new logs
        const summaryData = summarizeLogs(newLogs);

        // Check if we still have clients after the async operations
        let activeClients = 0;
        clients.forEach(clientRef => {
          const controller = clientRef.deref();
          if (controller && controller.desiredSize !== null) {
            activeClients++;
          }
        });

        // Only send data if we still have active clients
        if (activeClients > 0) {
          // If we have too many logs, handle them in batches
          if (newLogs.length > 10) {
            // First send just the summaries
            sendSSEMessage({
              type: 'summaries_update',
              summaries: summaryData,
            });

            // Then send logs in smaller batches
            const batchSize = 5;
            for (let i = 0; i < newLogs.length; i += batchSize) {
              // Check again if we have clients
              let stillHaveClients = false;
              clients.forEach(clientRef => {
                const controller = clientRef.deref();
                if (controller && controller.desiredSize !== null) {
                  stillHaveClients = true;
                }
              });

              if (!stillHaveClients) break;

              const batch = newLogs.slice(i, i + batchSize);
              sendSSEMessage({
                type: 'logs_update',
                logs: batch,
                // Only include summaries in the first batch to avoid duplication
                summaries: i === 0 ? summaryData : [],
              });
            }
          } else {
            // For smaller batches, send everything together
            sendSSEMessage({
              type: 'logs_update',
              logs: newLogs,
              summaries: summaryData,
            });
          }
        } else {
          console.log('No active clients remaining, skipping message send');
        }
      } catch (error) {
        console.error('Error processing logs or summaries:', error);
      }
    }

    // Schedule next poll if we still have clients
    if (clients.size > 0) {
      pollingTimeoutRef = setTimeout(pollForNewLogs, POLLING_INTERVAL);
    } else {
      console.log('No clients left after polling, stopping polling cycle');
    }
  } catch (error) {
    console.error('Error polling for logs:', error);
  } finally {
    isPolling = false;
  }
}

// Initialize polling
let pollingInitialized = false;

// Add proper export type for the GET function
export type GET = typeof GET;

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
        controller.enqueue(
          new TextEncoder().encode('data: {"message": "Connected to logs stream"}\n\n')
        );

        // Start polling if not already polling
        // We need to check both isPolling and pollingTimeoutRef to handle all cases
        if (!isPolling && !pollingTimeoutRef) {
          console.log('Starting polling for new logs');
          pollingTimeoutRef = setTimeout(pollForNewLogs, 0);
        } else if (pollingTimeoutRef) {
          console.log('Polling already scheduled');
        } else if (isPolling) {
          console.log('Polling already in progress');
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
        // But we can trigger a cleanup to remove any stale clients
        console.log(`Client disconnected. Remaining clients: ${clients.size - 1}`);

        // Force an immediate cleanup to remove this client
        if (!cleanupTimeoutRef) {
          cleanupTimeoutRef = setTimeout(cleanupStaleClients, 0);
        }
      } catch (error) {
        console.error('Error in SSE cancel handler:', error);
      }
    },
  });

  // Return the stream with appropriate headers
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
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
        summaries: summaryData,
      });

      // Then send logs in smaller batches
      const batchSize = 5;
      for (let i = 0; i < recentLogs.length; i += batchSize) {
        const batch = recentLogs.slice(i, i + batchSize);
        sendSSEMessage({
          type: 'logs_update',
          logs: batch,
          summaries: i === 0 ? summaryData : [], // Only include summaries in the first batch
        });
      }
    } else {
      // For small log batches, send everything together
      sendSSEMessage({
        type: 'logs_update',
        logs: recentLogs,
        summaries: summaryData,
      });
    }
  }
};
