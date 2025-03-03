import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { episodesTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const showId = parseInt(params.id);
    const episodes = await db.select()
      .from(episodesTable)
      .where(eq(episodesTable.showId, showId))
      .orderBy(episodesTable.episodeNumber);
    
    return NextResponse.json(episodes);
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return NextResponse.json({ error: 'Failed to fetch episodes' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const showId = parseInt(params.id);
    const body = await request.json();
    const { episodeNumber, isDownloaded, magnetLink } = body;
    
    const newEpisode = await db.insert(episodesTable).values({
      showId,
      episodeNumber,
      isDownloaded,
      magnetLink,
    }).returning();
    
    return NextResponse.json(newEpisode[0]);
  } catch (error) {
    console.error('Error creating episode:', error);
    return NextResponse.json({ error: 'Failed to create episode' }, { status: 500 });
  }
} 