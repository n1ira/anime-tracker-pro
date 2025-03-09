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

// Helper function to summarize logs for the frontend
export function summarizeLogs(logs: any[]) {
  // Get the timestamp field being used (some logs use 'createdAt', others use 'timestamp')
  const getTimestamp = (log: any) => log.createdAt || log.timestamp;

  // First ensure logs are in chronological order (oldest first)
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(getTimestamp(a)).getTime() - new Date(getTimestamp(b)).getTime()
  );

  // Extract scan operations
  const scanOperations: any[] = [];
  let currentOperation: any = null;
  let globalScanOperation: any = null; // Track the overall scan operation
  const specificShowOperations = new Map<string, any>(); // Track operations by show name

  // Look for evidence of scan completion
  const hasScanCompleted = sortedLogs.some(
    log => log.message && log.message.includes('Scan completed for all shows')
  );

  for (const log of sortedLogs) {
    // Skip logs that aren't related to scanning
    if (!log.message) continue;

    // Start of a new scan for all shows
    if (log.message.includes('Starting scan for all shows')) {
      // Initialize the global scan operation
      globalScanOperation = {
        id: `scan_all_${log.id}`,
        timestamp: getTimestamp(log),
        show: 'All Shows',
        target: 'Not specified',
        status: 'In progress',
        details: '',
        logs: [log],
      };
    }
    // Start of a scan for a specific show
    else if (log.message.includes('Scanning show:')) {
      // Extract show name
      const match = log.message.match(/Scanning show: (.*)/);
      if (match && match[1]) {
        const showName = match[1].trim();

        // Create or update show-specific operation
        const showOperation = {
          id: `scan_show_${showName}_${log.id}`,
          timestamp: getTimestamp(log),
          show: showName,
          target: 'Not specified',
          status: 'In progress',
          details: '',
          logs: [log],
        };

        // Store in our map
        specificShowOperations.set(showName, showOperation);

        // Keep track of the current operation for subsequent logs
        currentOperation = showOperation;
      }
    }
    // Handle specific show scanning information
    else if (log.message.includes('episodes downloaded in configured range')) {
      // This log contains important details about the show being scanned
      const showMatch = log.message.match(/Scanning (.+?):/);
      if (showMatch && showMatch[1] && currentOperation) {
        // Update the current operation with these details
        currentOperation.details = log.message;
      }
    }
    // Handle target episode information
    else if (log.message.includes('Searching for') && log.message.includes('absolute #')) {
      if (currentOperation) {
        const episodeMatch = log.message.match(/S(\d+)E(\d+)/);
        if (episodeMatch) {
          currentOperation.target = `S${episodeMatch[1]}E${episodeMatch[2]}`;
        }
      }
    }
    // Handle found episode and download success
    else if (
      (log.level === 'success' || log.level === 'SUCCESS') &&
      (log.message.includes('Found episode') ||
        (log.message.includes('Marked') && log.message.includes('as downloaded')))
    ) {
      // Extract show name from the message
      let showName = null;

      // Try to extract show name from "Found episode X of ShowName: ..."
      const foundMatch = log.message.match(/Found episode .* of ([^:]+):/);
      if (foundMatch && foundMatch[1]) {
        showName = foundMatch[1].trim();
      }

      // If we couldn't extract from the "Found" message, check if it's a "Marked as downloaded" message
      if (!showName && log.message.includes('Marked') && currentOperation) {
        // Use the current operation's show name since these messages come after Found messages
        showName = currentOperation.show;
      }

      // If we have a show name, update or create an operation for it
      if (showName) {
        // Get existing operation or create a new one
        let showOperation = specificShowOperations.get(showName);

        if (!showOperation) {
          // Create a new operation if one doesn't exist
          showOperation = {
            id: `scan_show_${showName}_${log.id}`,
            timestamp: getTimestamp(log),
            show: showName,
            target: currentOperation ? currentOperation.target : 'Not specified',
            status: 'Downloaded',
            details: log.message,
            logs: [],
          };
          specificShowOperations.set(showName, showOperation);
        } else {
          // Update existing operation
          showOperation.status = 'Downloaded';
          showOperation.details = log.message;
        }

        // Add this log to the operation
        showOperation.logs.push(log);
      }
    }
    // Handle episode not found
    else if (
      (log.message.includes('stopping scan') ||
        log.message.includes('No results found') ||
        log.message.includes('No valid episodes found')) &&
      currentOperation
    ) {
      currentOperation.status = 'Not found';
    }
    // Scan completed for a specific show
    else if (log.message.includes('Scan completed for') && !log.message.includes('all shows')) {
      // Extract show name
      const match = log.message.match(/Scan completed for (.*)/);
      if (match && match[1]) {
        const showName = match[1].trim();
        const showOperation = specificShowOperations.get(showName);

        if (showOperation) {
          // Update status only if it's still in progress
          if (showOperation.status === 'In progress') {
            showOperation.status = 'Completed';
          }

          // Add to scan operations if not already added
          if (!scanOperations.some(op => op.id === showOperation.id)) {
            scanOperations.push({ ...showOperation });
          }
        }
      }
    }
    // Scan completed for all shows
    else if (log.message.includes('Scan completed for all shows') && globalScanOperation) {
      globalScanOperation.status = 'Completed';

      // Add global scan operation if not already added
      if (!scanOperations.some(op => op.id === globalScanOperation.id)) {
        scanOperations.push({ ...globalScanOperation });
      }
    }

    // Add the log to the appropriate operations
    if (globalScanOperation) {
      globalScanOperation.logs.push(log);
    }

    if (currentOperation) {
      currentOperation.logs.push(log);
    }
  }

  // Add any remaining show operations that weren't added
  specificShowOperations.forEach(operation => {
    if (!scanOperations.some(op => op.id === operation.id)) {
      scanOperations.push({ ...operation });
    }
  });

  // Add the global operation if it wasn't added
  if (globalScanOperation && !scanOperations.some(op => op.id === globalScanOperation.id)) {
    scanOperations.push({ ...globalScanOperation });
  }

  // If we have show-specific operations but no scans were found, make sure we have at least
  // some representation of each show in our summaries
  if (
    specificShowOperations.size > 0 &&
    scanOperations.filter(op => op.show !== 'All Shows').length === 0
  ) {
    specificShowOperations.forEach(operation => {
      scanOperations.push({ ...operation });
    });
  }

  // Create summaries from the operations
  const summaries = scanOperations.map(op => ({
    id: op.id,
    timestamp: op.timestamp,
    show: op.show,
    target: op.target,
    status: op.status,
    details: op.details,
  }));

  // Sort by timestamp (newest first) and remove duplicates
  const uniqueSummaries = Array.from(new Map(summaries.map(item => [item.id, item])).values());

  const result = uniqueSummaries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // If we have no summaries but have logs, this might be an error
  // This can happen after the scan is complete if we're not properly tracking summaries
  if (result.length === 0 && sortedLogs.length > 0 && hasScanCompleted) {
    console.log('Warning: No summaries generated despite having logs and completed scan');

    // Create a fallback summary for completed scans
    const lastScanCompletionLog = [...sortedLogs]
      .reverse()
      .find(log => log.message && log.message.includes('Scan completed for'));

    if (lastScanCompletionLog) {
      // Extract show name
      const match = lastScanCompletionLog.message.match(/Scan completed for (.*)/);
      const showName =
        match && match[1] && match[1] !== 'all shows' ? match[1].trim() : 'All Shows';

      // Create fallback summary
      return [
        {
          id: `fallback_${lastScanCompletionLog.id}`,
          timestamp: getTimestamp(lastScanCompletionLog),
          show: showName,
          target: 'Not specified',
          status: 'Completed',
          details: 'Scan completed',
        },
      ];
    }
  }

  return result;
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

    const logs = await db
      .select()
      .from(logsTable)
      .orderBy(desc(logsTable.createdAt))
      .limit(validLimit)
      .offset(validOffset);

    // Return the logs, optionally with summaries for the frontend
    return NextResponse.json({
      logs,
      summary: summarizeLogs(logs),
    });
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
      newLog = await db
        .insert(logsTable)
        .values({
          message: 'All logs have been cleared',
          level: 'info',
          createdAt: new Date(),
        })
        .returning();
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
    return NextResponse.json(
      {
        error: 'Failed to clear logs',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Helper function to safely send SSE messages
function sendSafeSSEMessage(data: any) {
  // Use setTimeout to make this non-blocking
  setTimeout(() => {
    try {
      if (_sendSSEMessage) {
        // Include summaries with the log update
        if (data && !data.type) {
          // Generate summaries for this log
          const summaries = summarizeLogs([data]);

          // Send both the log and the summaries
          _sendSSEMessage({
            type: 'logs_update',
            logs: [data],
            summaries: summaries,
          });
        } else {
          _sendSSEMessage(data);
        }
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

    const newLog = await db
      .insert(logsTable)
      .values({
        level,
        message,
        createdAt: new Date(),
      })
      .returning();

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
