import { showsTable, episodesTable, logsTable, scanStateTable, settingsTable } from './schema';
import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

config({ path: ".env.local" })

const schema = { 
  shows: showsTable, 
  episodes: episodesTable, 
  logs: logsTable, 
  scanState: scanStateTable, 
  settings: settingsTable 
}

// Configure connection pool with optimized settings
const client = postgres(process.env.DATABASE_URL!, {
  max: 8, // Reduced from 10 to 8 connections to prevent connection exhaustion
  idle_timeout: 15, // Reduced from 20 to 15 seconds to release idle connections faster
  connect_timeout: 10, // Connection timeout after 10 seconds
  max_lifetime: 60 * 20, // Reduced from 30 to 20 minutes to prevent stale connections
  debug: process.env.NODE_ENV === 'development', // Only enable debug in development
  onnotice: () => {}, // Ignore notice messages to reduce console noise
  onparameter: () => {}, // Ignore parameter messages to reduce console noise
})

export const db = drizzle(client, { schema })

// Define the shutdown function with improved error handling
const closeDbConnection = async () => {
  console.log('Closing database connections...');
  try {
    // Set a timeout to force exit if connections don't close gracefully
    const forceExitTimeout = setTimeout(() => {
      console.error('Database connections did not close in time, forcing exit');
      process.exit(1);
    }, 5000);
    
    // Clear the timeout if connections close successfully
    await client.end({ timeout: 5 });
    clearTimeout(forceExitTimeout);
    
    console.log('Database connections closed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error closing database connections:', err);
    process.exit(1);
  }
};

// Remove any existing SIGINT and SIGTERM listeners to prevent duplicates during hot reloading
const sigintListeners = process.listeners('SIGINT');
sigintListeners.forEach(listener => {
  process.removeListener('SIGINT', listener);
});

const sigtermListeners = process.listeners('SIGTERM');
sigtermListeners.forEach(listener => {
  process.removeListener('SIGTERM', listener);
});

// Register our handlers for both SIGINT and SIGTERM
process.on('SIGINT', closeDbConnection);
process.on('SIGTERM', closeDbConnection);

// Log basic connection info in development
if (process.env.NODE_ENV === 'development') {
  console.log('Database connection configured with:', {
    max_connections: client.options.max,
    idle_timeout: client.options.idle_timeout,
    max_lifetime: client.options.max_lifetime
  });
}