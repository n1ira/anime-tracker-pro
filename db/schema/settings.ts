import { pgTable, serial, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const settingsTable = pgTable('settings', {
  id: serial('id').primaryKey(),
  openaiApiKey: varchar('openai_api_key', { length: 255 }),
  useSystemEnvVar: boolean('use_system_env_var').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
}); 