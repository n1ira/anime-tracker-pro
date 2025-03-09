import { pgTable, serial, varchar, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const scanStateTable = pgTable('scan_state', {
  id: serial('id').primaryKey(),
  isScanning: boolean('is_scanning').default(false),
  currentShowId: integer('current_show_id').default(0),
  status: varchar('status', { length: 50 }).default('idle'),
  startedAt: timestamp('started_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
});
