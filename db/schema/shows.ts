import { pgTable, serial, varchar, boolean, integer, timestamp, text } from 'drizzle-orm/pg-core';

export const showsTable = pgTable('shows', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  alternateNames: text('alternate_names').default('[]'), // Stored as JSON string
  // Note: currentEpisode and totalEpisodes are now calculated dynamically
  // currentEpisode: Based on the next episode after the latest downloaded episode
  // totalEpisodes: Based on the sum of episodes for all seasons
  startSeason: integer('start_season').default(1),
  startEpisode: integer('start_episode').default(1),
  endSeason: integer('end_season').default(1),
  endEpisode: integer('end_episode').default(1),
  episodesPerSeason: text('episodes_per_season').default('12'), // Store either a number or JSON array of numbers
  quality: varchar('quality', { length: 10 }).default('1080p'),
  status: varchar('status', { length: 50 }).default('ongoing'),
  lastScanned: timestamp('last_scanned'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
