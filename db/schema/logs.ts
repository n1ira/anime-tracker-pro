import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const logsTable = pgTable('logs', {
  id: serial('id').primaryKey(),
  level: varchar('level', { length: 20 }).notNull().default('info'),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}); 