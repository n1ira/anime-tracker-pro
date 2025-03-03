import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { showsTable, episodesTable, logsTable } from '@/db/schema';
import { eq, and, lte, gt, desc } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    // Validate that id is a valid number
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid show ID' }, { status: 400 });
    }
    
    const show = await db.select().from(showsTable).where(eq(showsTable.id, id));
    
    if (show.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }
    
    return NextResponse.json(show[0]);
  } catch (error) {
    console.error('Error fetching show:', error);
    return NextResponse.json({ error: 'Failed to fetch show' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const data = await request.json();
  const id = parseInt(params.id);

  // Validate that id is a valid number
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid show ID' }, { status: 400 });
  }

  try {
    // Get the current show data to compare changes
    const currentShow = await db.select().from(showsTable).where(eq(showsTable.id, id));
    if (currentShow.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }
    
    // Check if range has changed
    const rangeChanged = 
      data.startSeason !== undefined && data.startSeason !== currentShow[0].startSeason ||
      data.startEpisode !== undefined && data.startEpisode !== currentShow[0].startEpisode ||
      data.endSeason !== undefined && data.endSeason !== currentShow[0].endSeason ||
      data.endEpisode !== undefined && data.endEpisode !== currentShow[0].endEpisode ||
      data.episodesPerSeason !== undefined && data.episodesPerSeason !== currentShow[0].episodesPerSeason;

    // Handle episodes per season update
    if (data.episodesPerSeason !== undefined) {
      // Convert the value to a string for storage
      if (Array.isArray(data.episodesPerSeason)) {
        data.episodesPerSeason = JSON.stringify(data.episodesPerSeason);
      } else if (typeof data.episodesPerSeason === 'number') {
        data.episodesPerSeason = data.episodesPerSeason.toString();
      }
      // Now data.episodesPerSeason will be included in the normal update flow below
    }

    console.log(`Updating show ${id} with data:`, data);
    
    // Create a clean update object with only the fields we want to update
    const updateData: Record<string, any> = {};
    
    // Copy non-date fields directly
    const nonDateFields = ['title', 'alternateNames', 'startSeason', 'startEpisode', 
                          'endSeason', 'endEpisode', 'quality', 'status', 'episodesPerSeason'];
    
    nonDateFields.forEach(field => {
      if (field in data) {
        updateData[field] = data[field];
      }
    });
    
    // Handle lastScanned field specifically
    if ('lastScanned' in data) {
      if (data.lastScanned === null) {
        updateData.lastScanned = null;
      } else if (typeof data.lastScanned === 'string' && data.lastScanned) {
        try {
          updateData.lastScanned = new Date(data.lastScanned);
        } catch (e) {
          updateData.lastScanned = null;
        }
      } else if (data.lastScanned instanceof Date) {
        updateData.lastScanned = data.lastScanned;
      } else {
        updateData.lastScanned = null;
      }
    }
    
    // Handle createdAt field if it's included (normally shouldn't be updated, but handle it just in case)
    if ('createdAt' in data) {
      if (data.createdAt === null) {
        // Don't update createdAt if null is provided - keep the existing value
      } else if (typeof data.createdAt === 'string' && data.createdAt) {
        try {
          updateData.createdAt = new Date(data.createdAt);
        } catch (e) {
          // If invalid, don't include it in the update
        }
      } else if (data.createdAt instanceof Date) {
        updateData.createdAt = data.createdAt;
      }
      // If invalid and not handled above, don't include it in the update
    }
    
    // Always set updatedAt to current date
    updateData.updatedAt = new Date();
    
    console.log("Cleaned update data:", updateData);
    
    // Update the show
    const updatedShow = await db.update(showsTable)
      .set(updateData)
      .where(eq(showsTable.id, id))
      .returning();
    
    if (updatedShow.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }
    
    console.log(`Show ${id} updated successfully:`, updatedShow[0]);
    
    // If show range or episodes per season changed, regenerate the episodes
    if (rangeChanged) {
      await regenerateEpisodes(id, updatedShow[0]);
      console.log(`Episodes regenerated for show ${id}`);
      
      // Log the action
      await db.insert(logsTable).values({
        level: 'info',
        message: `Episodes regenerated for show "${updatedShow[0].title}" due to range change`,
      });
    }
    
    return NextResponse.json(updatedShow[0]);
  } catch (error) {
    console.error('Error updating show:', error);
    return NextResponse.json({ 
      error: 'Failed to update show', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Regenerates episodes for a show based on the new range
 * This will create new episodes if needed and maintain download status for existing episodes
 */
async function regenerateEpisodes(showId: number, show: any) {
  try {
    console.log(`Regenerating episodes for show #${showId} with range: S${show.startSeason || 1}E${show.startEpisode || 1} to S${show.endSeason || 1}E${show.endEpisode || 1}`);
    
    // Get existing episodes to preserve their download status
    const existingEpisodes = await db.select()
      .from(episodesTable)
      .where(eq(episodesTable.showId, showId));
    
    // Create a map of episode number to download status
    const episodeStatusMap = new Map();
    existingEpisodes.forEach(ep => {
      episodeStatusMap.set(ep.episodeNumber, ep.isDownloaded);
    });
    
    // Parse episodesPerSeason
    let episodesPerSeason: number | number[] = 12;
    if (show.episodesPerSeason) {
      try {
        const parsed = JSON.parse(show.episodesPerSeason);
        if (Array.isArray(parsed)) {
          episodesPerSeason = parsed;
        } else {
          episodesPerSeason = parseInt(show.episodesPerSeason, 10) || 12;
        }
      } catch (e) {
        // Not JSON, treat as a number
        episodesPerSeason = parseInt(show.episodesPerSeason, 10) || 12;
      }
    }
    
    const startSeason = show.startSeason || 1;
    const startEpisode = show.startEpisode || 1;
    const endSeason = show.endSeason || 1;
    const endEpisode = show.endEpisode || 1;
    
    // Delete all existing episodes
    await db.delete(episodesTable)
      .where(eq(episodesTable.showId, showId));
    
    // Create new episodes batch
    const episodes = [];
    
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
    
    // Generate only the episodes within the specified range
    for (let season = startSeason; season <= endSeason; season++) {
      const seasonEpisodeCount = Array.isArray(episodesPerSeason) 
        ? (season <= episodesPerSeason.length ? episodesPerSeason[season - 1] : episodesPerSeason[episodesPerSeason.length - 1])
        : episodesPerSeason;
      
      const firstEpisode = season === startSeason ? startEpisode : 1;
      const lastEpisode = season === endSeason ? endEpisode : seasonEpisodeCount;
      
      console.log(`Creating episodes for Season ${season}: ${firstEpisode} to ${lastEpisode}`);
      
      for (let episodeInSeason = firstEpisode; episodeInSeason <= lastEpisode; episodeInSeason++) {
        const absoluteEpisode = calculateAbsoluteEpisode(season, episodeInSeason);
        
        console.log(`Created episode S${season}E${episodeInSeason} with absolute number ${absoluteEpisode}`);
        
        episodes.push({
          showId,
          episodeNumber: absoluteEpisode,
          isDownloaded: episodeStatusMap.has(absoluteEpisode) ? episodeStatusMap.get(absoluteEpisode) : false,
          magnetLink: null,
        });
      }
    }
    
    console.log(`Generated ${episodes.length} episodes for the range S${startSeason}E${startEpisode} to S${endSeason}E${endEpisode}`);
    
    // Insert in batches to avoid hitting database limits
    const batchSize = 100;
    for (let i = 0; i < episodes.length; i += batchSize) {
      const batch = episodes.slice(i, i + batchSize);
      if (batch.length > 0) {
        await db.insert(episodesTable).values(batch);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error regenerating episodes:', error);
    throw error;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    // Validate that id is a valid number
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid show ID' }, { status: 400 });
    }
    
    // First delete all episodes for this show
    await db.delete(episodesTable)
      .where(eq(episodesTable.showId, id));
    
    // Then delete the show
    const deletedShow = await db.delete(showsTable)
      .where(eq(showsTable.id, id))
      .returning();
    
    if (deletedShow.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Show deleted successfully' });
  } catch (error) {
    console.error('Error deleting show:', error);
    return NextResponse.json({ error: 'Failed to delete show' }, { status: 500 });
  }
}