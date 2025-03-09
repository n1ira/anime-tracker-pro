import { pgTable, serial, varchar, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { showsTable } from './shows';

export const episodesTable = pgTable('episodes', {
  id: serial('id').primaryKey(),
  showId: integer('show_id')
    .references(() => showsTable.id)
    .notNull(),
  episodeNumber: integer('episode_number').notNull(),
  isDownloaded: boolean('is_downloaded').default(false),
  magnetLink: varchar('magnet_link', { length: 2000 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
