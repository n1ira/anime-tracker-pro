import { db } from '@/db/db';
import { logsTable } from '@/db/schema';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

/**
 * Create a log entry in the database and console
 * @param message The log message
 * @param level The log level
 * @returns Promise that resolves when the log is created
 */
export async function createLog(message: string, level: LogLevel = 'info'): Promise<void> {
  // Skip repetitive logs for frontend display
  // These will still be logged to the console but not saved to the database
  const isRepetitiveLog = 
    (message.startsWith('Direct match failed:') || 
     message.startsWith('Comparing episodes for') ||
     message.startsWith('Parsed title'));
  
  console.log(`${level.toUpperCase()}: ${message}`);
  
  if (isRepetitiveLog) {
    return; // Skip saving repetitive logs to the database
  }
  
  try {
    await db.insert(logsTable).values({
      message,
      level,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error(`Error creating log: ${error}`);
  }
}

/**
 * Log a debug message
 * @param message The log message
 */
export function logDebug(message: string): void {
  console.log(`DEBUG: ${message}`);
}

/**
 * Log an info message and save to database
 * @param message The log message
 */
export async function logInfo(message: string): Promise<void> {
  await createLog(message, 'info');
}

/**
 * Log a warning message and save to database
 * @param message The log message
 */
export async function logWarning(message: string): Promise<void> {
  await createLog(message, 'warning');
}

/**
 * Log an error message and save to database
 * @param message The log message
 * @param error Optional error object
 */
export async function logError(message: string, error?: unknown): Promise<void> {
  const errorDetails = error instanceof Error ? `: ${error.message}` : '';
  await createLog(`${message}${errorDetails}`, 'error');
  
  if (error) {
    console.error(error);
  }
} 