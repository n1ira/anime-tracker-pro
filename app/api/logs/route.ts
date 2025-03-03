import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { logsTable } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const logs = await db.select()
      .from(logsTable)
      .orderBy(desc(logsTable.createdAt))
      .limit(100);
    
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { level, message } = body;
    
    const newLog = await db.insert(logsTable).values({
      level,
      message,
    }).returning();
    
    return NextResponse.json(newLog[0]);
  } catch (error) {
    console.error('Error creating log:', error);
    return NextResponse.json({ error: 'Failed to create log' }, { status: 500 });
  }
} 