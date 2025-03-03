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

// Configure connection pool with proper settings
const client = postgres(process.env.DATABASE_URL!, {
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout after 10 seconds
  max_lifetime: 60 * 30, // Connection lifetime of 30 minutes
  debug: false, // Disable debug logging
})

export const db = drizzle(client, { schema })

// Define the shutdown function
const closeDbConnection = async () => {
  console.log('Closing database connections...');
  try {
    await client.end({ timeout: 5 });
    console.log('Database connections closed');
    process.exit(0);
  } catch (err) {
    console.error('Error closing database connections:', err);
    process.exit(1);
  }
};

// Remove any existing SIGINT listeners to prevent duplicates during hot reloading
// This is important in development with HMR (Hot Module Replacement)
const listeners = process.listeners('SIGINT');
listeners.forEach(listener => {
  process.removeListener('SIGINT', listener);
});

// Register our handler
process.on('SIGINT', closeDbConnection);