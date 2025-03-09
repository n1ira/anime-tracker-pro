/**
 * Utility functions for calculating absolute episode numbers from season/episode
 */

type EpisodesPerSeasonData = number | number[];

/**
 * Calculate the absolute episode number from a season and episode
 * For example, if season 1 has 12 episodes, season 2 episode 6 would be episode 18
 */
export function calculateAbsoluteEpisode(
  showName: string, 
  season: number, 
  episode: number,
  episodesPerSeason: Record<string, { episodes_per_season: EpisodesPerSeasonData }> = {}
): number {
  // Get episodes per season data for this show, defaulting to 12 episodes per season
  const epsData = episodesPerSeason[showName]?.episodes_per_season || 12;
  
  console.log(`DEBUG: calculateAbsoluteEpisode for ${showName}, S${season}E${episode}`);
  console.log(`DEBUG: episodesPerSeason data:`, JSON.stringify(episodesPerSeason));
  console.log(`DEBUG: epsData for ${showName}:`, JSON.stringify(epsData));
  
  // Handle array format (different number of episodes per season)
  if (Array.isArray(epsData)) {
    // Sum of all episodes in seasons before the current season
    const seasonsBefore = epsData.slice(0, season - 1);
    const total = seasonsBefore.reduce((sum, eps) => sum + eps, 0);
    const result = total + episode;
    
    console.log(`DEBUG: Array format. Seasons before current (${season}):`, JSON.stringify(seasonsBefore));
    console.log(`DEBUG: Episodes per season data:`, JSON.stringify(epsData));
    console.log(`DEBUG: Sum of episodes in previous seasons: ${total}`);
    console.log(`DEBUG: Final absolute episode: ${result} (${total} + ${episode})`);
    
    return result;
  }
  
  // Simple calculation for constant episodes per season
  const result = (season - 1) * epsData + episode;
  console.log(`DEBUG: Fixed format. Calculation: (${season} - 1) * ${epsData} + ${episode} = ${result}`);
  
  return result;
}

/**
 * Get the season and episode number from an absolute episode number
 */
export function getSeasonAndEpisode(
  absoluteEpisode: number,
  showName: string,
  episodesPerSeason: Record<string, { episodes_per_season: EpisodesPerSeasonData }> = {}
): { season: number, episode: number } {
  // Get episodes per season data for this show, defaulting to 12 episodes per season
  const epsData = episodesPerSeason[showName]?.episodes_per_season || 12;
  
  console.log(`DEBUG: getSeasonAndEpisode for absolute episode ${absoluteEpisode} of "${showName}"`);
  console.log(`DEBUG: Using episodes per season data:`, JSON.stringify(epsData));
  
  if (Array.isArray(epsData)) {
    let remainingEpisodes = absoluteEpisode;
    let season = 1;
    
    console.log(`DEBUG: Array format - calculating season for episode ${absoluteEpisode}`);
    
    // Determine which season the episode belongs to
    while (season <= epsData.length) {
      const episodesInSeason = epsData[season - 1];
      console.log(`DEBUG: Season ${season} has ${episodesInSeason} episodes, remaining: ${remainingEpisodes}`);
      
      if (remainingEpisodes <= episodesInSeason) {
        // Found the season, so return it with the correct episode number
        console.log(`DEBUG: Episode ${absoluteEpisode} is S${season}E${remainingEpisodes}`);
        return { season, episode: remainingEpisodes };
      }
      remainingEpisodes -= episodesInSeason;
      season++;
    }
    
    // If we get here, it means the absoluteEpisode is beyond the defined seasons
    // Calculate the season and episode based on the last known season's episode count
    const lastSeasonEpisodeCount = epsData[epsData.length - 1];
    const additionalSeasons = Math.floor(remainingEpisodes / lastSeasonEpisodeCount);
    const remainingEpisodeInLastSeason = remainingEpisodes % lastSeasonEpisodeCount;
    
    const calculatedSeason = epsData.length + additionalSeasons + (remainingEpisodeInLastSeason > 0 ? 1 : 0);
    const calculatedEpisode = remainingEpisodeInLastSeason === 0 ? lastSeasonEpisodeCount : remainingEpisodeInLastSeason;
    
    console.log(`DEBUG: Episode ${absoluteEpisode} is beyond defined seasons. Calculated S${calculatedSeason}E${calculatedEpisode}`);
    
    return {
      season: calculatedSeason,
      episode: calculatedEpisode
    };
  } else {
    // Simple calculation for constant episodes per season
    const season = Math.floor((absoluteEpisode - 1) / epsData) + 1;
    const episode = ((absoluteEpisode - 1) % epsData) + 1;
    console.log(`DEBUG: Fixed format (${epsData} per season). Episode ${absoluteEpisode} is S${season}E${episode}`);
    return { season, episode };
  }
} 