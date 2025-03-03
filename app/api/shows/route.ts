import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { showsTable } from '@/db/schema';

export async function GET() {
  try {
    const shows = await db.select().from(showsTable);
    return NextResponse.json(shows);
  } catch (error) {
    console.error('Error fetching shows:', error);
    return NextResponse.json({ error: 'Failed to fetch shows' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, currentEpisode, totalEpisodes, status } = body;
    
    const newShow = await db.insert(showsTable).values({
      title,
      currentEpisode,
      totalEpisodes,
      status,
    }).returning();
    
    return NextResponse.json(newShow[0]);
  } catch (error) {
    console.error('Error creating show:', error);
    return NextResponse.json({ error: 'Failed to create show' }, { status: 500 });
  }
} 