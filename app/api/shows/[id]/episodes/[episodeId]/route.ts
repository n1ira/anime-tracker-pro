import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { episodesTable } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { id: string; episodeId: string } }
) {
  try {
    const showId = parseInt(params.id);
    const episodeId = parseInt(params.episodeId);

    // Validate that both IDs are valid numbers
    if (isNaN(showId) || isNaN(episodeId)) {
      return NextResponse.json({ error: 'Invalid show ID or episode ID' }, { status: 400 });
    }

    const episode = await db
      .select()
      .from(episodesTable)
      .where(and(eq(episodesTable.id, episodeId), eq(episodesTable.showId, showId)));

    if (episode.length === 0) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    return NextResponse.json(episode[0]);
  } catch (error) {
    console.error('Error fetching episode:', error);
    return NextResponse.json({ error: 'Failed to fetch episode' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string; episodeId: string } }
) {
  try {
    const showId = parseInt(params.id);
    const episodeId = parseInt(params.episodeId);
    const body = await request.json();

    const updatedEpisode = await db
      .update(episodesTable)
      .set(body)
      .where(and(eq(episodesTable.id, episodeId), eq(episodesTable.showId, showId)))
      .returning();

    if (updatedEpisode.length === 0) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    return NextResponse.json(updatedEpisode[0]);
  } catch (error) {
    console.error('Error updating episode:', error);
    return NextResponse.json({ error: 'Failed to update episode' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; episodeId: string } }
) {
  try {
    const showId = parseInt(params.id);
    const episodeId = parseInt(params.episodeId);

    const deletedEpisode = await db
      .delete(episodesTable)
      .where(and(eq(episodesTable.id, episodeId), eq(episodesTable.showId, showId)))
      .returning();

    if (deletedEpisode.length === 0) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Episode deleted successfully' });
  } catch (error) {
    console.error('Error deleting episode:', error);
    return NextResponse.json({ error: 'Failed to delete episode' }, { status: 500 });
  }
}
