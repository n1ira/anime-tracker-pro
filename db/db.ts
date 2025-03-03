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

const client = postgres(process.env.DATABASE_URL!)

export const db = drizzle(client, { schema })