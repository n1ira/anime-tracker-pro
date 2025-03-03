import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { episodesTable, showsTable } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getSeasonAndEpisode } from '@/app/utils/episodeCalculator';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const showId = parseInt(params.id);
    
    // Validate that id is a valid number
    if (isNaN(showId)) {
      return NextResponse.json({ error: 'Invalid show ID' }, { status: 400 });
    }
    
    // First, get the show to determine the configured range
    const show = await db.select()
      .from(showsTable)
      .where(eq(showsTable.id, showId))
      .limit(1);
    
    if (!show || show.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }
    
    // Get all episodes for this show
    const allEpisodes = await db.select()
      .from(episodesTable)
      .where(eq(episodesTable.showId, showId))
      .orderBy(episodesTable.episodeNumber);
    
    // If no range is configured, return all episodes
    if (!show[0].startSeason && !show[0].endSeason) {
      return NextResponse.json(allEpisodes);
    }
    
    // Parse episodesPerSeason
    let episodesPerSeason: number | number[] = 12;
    if (show[0].episodesPerSeason) {
      try {
        const parsed = JSON.parse(show[0].episodesPerSeason);
        if (Array.isArray(parsed)) {
          episodesPerSeason = parsed;
        } else {
          episodesPerSeason = parseInt(show[0].episodesPerSeason, 10) || 12;
        }
      } catch (e) {
        episodesPerSeason = parseInt(show[0].episodesPerSeason, 10) || 12;
      }
    }
    
    // Filter episodes based on the show's range
    const startSeason = show[0].startSeason || 1;
    const startEpisode = show[0].startEpisode || 1;
    const endSeason = show[0].endSeason || 1;
    const endEpisode = show[0].endEpisode || 12;
    
    // Helper function to calculate absolute episode number
    const calculateAbsoluteEpisode = (season: number, episode: number): number => {
      if (Array.isArray(episodesPerSeason)) {
        let absoluteEpisode = 0;
        for (let s = 1; s < season; s++) {
          const seasonEps = s <= episodesPerSeason.length 
            ? episodesPerSeason[s - 1] 
            : (episodesPerSeason[episodesPerSeason.length - 1] || 12);
          absoluteEpisode += seasonEps;
        }
        return absoluteEpisode + episode;
      } else {
        return (season - 1) * episodesPerSeason + episode;
      }
    };
    
    // Calculate min and max absolute episode numbers
    const minEpisode = calculateAbsoluteEpisode(startSeason, startEpisode);
    const maxEpisode = calculateAbsoluteEpisode(endSeason, endEpisode);
    
    console.log(`Filtering episodes for range S${startSeason}E${startEpisode} to S${endSeason}E${endEpisode}`);
    console.log(`Absolute episode range: ${minEpisode} to ${maxEpisode}`);
    
    // Filter episodes that fall within the range
    const filteredEpisodes = allEpisodes.filter(ep => {
      return ep.episodeNumber >= minEpisode && ep.episodeNumber <= maxEpisode;
    });
    
    console.log(`Returning ${filteredEpisodes.length} episodes within the range`);
    
    return NextResponse.json(filteredEpisodes);
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