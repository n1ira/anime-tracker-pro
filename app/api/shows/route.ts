import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { showsTable, episodesTable } from '@/db/schema';

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
    const { 
      title, 
      alternateNames, 
      startSeason, 
      startEpisode, 
      endSeason, 
      endEpisode, 
      episodesPerSeason,
      quality, 
      status 
    } = body;
    
    // Create the show
    const newShow = await db.insert(showsTable).values({
      title,
      alternateNames,
      startSeason,
      startEpisode,
      endSeason,
      endEpisode,
      episodesPerSeason,
      quality,
      status,
    }).returning();
    
    const showId = newShow[0].id;
    
    // Calculate total episodes based on episodesPerSeason
    let totalEpisodes = 0;
    try {
      // Try to parse episodesPerSeason as JSON array
      const episodesArray = JSON.parse(episodesPerSeason);
      if (Array.isArray(episodesArray)) {
        // We have a different number for each season
        // We need to make sure we have enough entries for all seasons
        const seasons = endSeason - startSeason + 1;
        
        // Sum up the episodes for all relevant seasons
        for (let i = 0; i < seasons; i++) {
          // If we have data for this season, use it, otherwise use the last available value or default to 12
          const episodeCount = i < episodesArray.length 
            ? episodesArray[i] 
            : (episodesArray.length > 0 ? episodesArray[episodesArray.length - 1] : 12);
          
          totalEpisodes += episodeCount;
        }
      } else {
        // Not an array, should be a number
        const singleValue = parseInt(episodesPerSeason) || 12;
        totalEpisodes = singleValue * (endSeason - startSeason + 1);
      }
    } catch (e) {
      // Not valid JSON, assume it's a simple number string
      const defaultEpisodes = parseInt(episodesPerSeason) || 12;
      totalEpisodes = defaultEpisodes * (endSeason - startSeason + 1);
    }
    
    // Create episode entries for the show (all marked as not downloaded initially)
    const episodeEntries = [];
    
    for (let i = 1; i <= totalEpisodes; i++) {
      episodeEntries.push({
        showId,
        episodeNumber: i,
        isDownloaded: false,
        magnetLink: null,
      });
    }
    
    if (episodeEntries.length > 0) {
      await db.insert(episodesTable).values(episodeEntries);
    }
    
    return NextResponse.json(newShow[0]);
  } catch (error) {
    console.error('Error creating show:', error);
    return NextResponse.json({ error: 'Failed to create show' }, { status: 500 });
  }
} 