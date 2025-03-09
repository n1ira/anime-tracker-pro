import { db } from '@/db/db';
import { logsTable } from '@/db/schema';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

/**
 * Creates a log entry in the database and console
 * @param message The log message
 * @param level The log level (info, success, error, warning)
 * @param skipDb If true, the log will only be printed to console but not saved to the database
 */
export async function createLog(
  message: string,
  level: 'info' | 'success' | 'error' | 'warning' = 'info',
  skipDb: boolean = false
) {
  // Skip repetitive logs if they match certain patterns
  const isRepetitiveLog =
    message.startsWith('Direct match failed:') ||
    message.startsWith('Comparing episodes for') ||
    message.startsWith('Parsed title');

  console.log(`${level.toUpperCase()}: ${message}`);

  if (skipDb || isRepetitiveLog) {
    return; // Skip saving to the database
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
 * Logs a message with info level
 */
export function logInfo(message: string, skipDb: boolean = false) {
  return createLog(message, 'info', skipDb);
}

/**
 * Logs a message with success level
 */
export function logSuccess(message: string, skipDb: boolean = false) {
  return createLog(message, 'success', skipDb);
}

/**
 * Logs a message with error level
 */
export function logError(message: string, skipDb: boolean = false) {
  return createLog(message, 'error', skipDb);
}

/**
 * Logs a message with warning level
 */
export function logWarning(message: string, skipDb: boolean = false) {
  return createLog(message, 'warning', skipDb);
}
