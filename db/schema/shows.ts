import { pgTable, serial, varchar, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const showsTable = pgTable('shows', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  currentEpisode: integer('current_episode').default(0),
  totalEpisodes: integer('total_episodes').default(0),
  status: varchar('status', { length: 50 }).default('ongoing'),
  lastScanned: timestamp('last_scanned'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}); 