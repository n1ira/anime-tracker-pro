import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { showsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET endpoint to search for a specific episode
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    const season = searchParams.get('season');
    const episode = searchParams.get('episode');

    if (!showId || !season || !episode) {
      return NextResponse.json(
        { error: 'Missing required parameters: showId, season, episode' },
        { status: 400 }
      );
    }

    // Get the show details
    const show = await db.select().from(showsTable).where(eq(showsTable.id, parseInt(showId, 10))).limit(1);
    
    if (show.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }

    // Make a POST request to the torrent search endpoint
    const response = await fetch(`${request.headers.get('origin')}/api/torrent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        showId: parseInt(showId, 10),
        season: parseInt(season, 10),
        episode: parseInt(episode, 10),
      }),
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in torrent search:', error);
    return NextResponse.json(
      { error: 'Failed to search for torrents' },
      { status: 500 }
    );
  }
} 