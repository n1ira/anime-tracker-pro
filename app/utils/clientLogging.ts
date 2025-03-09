/**
 * Log levels for client-side logging
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Configuration for client-side logging
 */
interface LogConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
}

/**
 * Default logging configuration
 */
const defaultConfig: LogConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG,
  enableConsole: process.env.NODE_ENV !== 'production',
  enableRemote: process.env.NODE_ENV === 'production',
  remoteEndpoint: '/api/logs',
};

/**
 * Current logging configuration
 */
let config: LogConfig = { ...defaultConfig };

/**
 * Configure the logger
 */
export function configureLogger(newConfig: Partial<LogConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Check if a log level should be logged based on the minimum level
 */
function shouldLog(level: LogLevel): boolean {
  const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
  const minLevelIndex = levels.indexOf(config.minLevel);
  const currentLevelIndex = levels.indexOf(level);

  return currentLevelIndex >= minLevelIndex;
}

/**
 * Send a log entry to the remote endpoint
 */
async function sendRemoteLog(entry: LogEntry): Promise<void> {
  if (!config.enableRemote || !config.remoteEndpoint) {
    return;
  }

  try {
    await fetch(config.remoteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entry),
    });
  } catch (error) {
    // Fallback to console if remote logging fails
    if (config.enableConsole) {
      console.error('Failed to send log to remote endpoint:', error);
    }
  }
}

/**
 * Log a message with the specified level
 */
export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  // Console logging
  if (config.enableConsole) {
    const consoleMethod = {
      [LogLevel.DEBUG]: console.debug,
      [LogLevel.INFO]: console.info,
      [LogLevel.WARN]: console.warn,
      [LogLevel.ERROR]: console.error,
    }[level];

    consoleMethod(`[${entry.level}] ${entry.message}`, entry.context || '');
  }

  // Remote logging
  if (config.enableRemote) {
    void sendRemoteLog(entry);
  }
}

/**
 * Log a debug message
 */
export function debug(message: string, context?: Record<string, unknown>): void {
  log(LogLevel.DEBUG, message, context);
}

/**
 * Log an info message
 */
export function info(message: string, context?: Record<string, unknown>): void {
  log(LogLevel.INFO, message, context);
}

/**
 * Log a warning message
 */
export function warn(message: string, context?: Record<string, unknown>): void {
  log(LogLevel.WARN, message, context);
}

/**
 * Log an error message
 */
export function error(message: string, context?: Record<string, unknown>): void {
  log(LogLevel.ERROR, message, context);
}

/**
 * Log an error with its stack trace
 */
export function logError(err: unknown, message?: string): void {
  const errorMessage = message || 'An error occurred';
  const errorObj = err instanceof Error ? err : new Error(String(err));

  error(errorMessage, {
    error: errorObj.message,
    stack: errorObj.stack,
    ...(err instanceof Error && err.cause ? { cause: err.cause } : {}),
  });
}
