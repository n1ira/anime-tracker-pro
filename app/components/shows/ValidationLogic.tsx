import React from 'react';

interface Show {
  id?: number;
  title: string;
  alternateNames: string; // JSON string of alternate names
  episodesPerSeason: string; // Number or JSON array of numbers
  startSeason: number;
  startEpisode: number;
  endSeason: number;
  endEpisode: number;
  quality: string;
  status: string;
}

interface ValidationLogicProps {
  show: Show;
  isEpisodesPerSeasonArray: boolean;
  alternateNames: string[];
  setError: (error: string | null) => void;
}

export function validateShowForm({
  show,
  isEpisodesPerSeasonArray,
  alternateNames,
  setError
}: ValidationLogicProps): boolean {
  // Validate title
  if (!show.title.trim()) {
    setError('Title is required');
    return false;
  }

  // Validate episodes per season
  if (isEpisodesPerSeasonArray) {
    try {
      const episodesArray = show.episodesPerSeason.split(',').map(num => {
        const parsed = parseInt(num.trim(), 10);
        if (isNaN(parsed) || parsed <= 0) {
          throw new Error('Invalid episode count');
        }
        return parsed;
      });
      
      if (episodesArray.length === 0) {
        setError('At least one episode count is required');
        return false;
      }
    } catch (err) {
      setError('Episodes per season must be valid numbers separated by commas');
      return false;
    }
  } else {
    const episodesPerSeason = parseInt(show.episodesPerSeason, 10);
    if (isNaN(episodesPerSeason) || episodesPerSeason <= 0) {
      setError('Episodes per season must be a positive number');
      return false;
    }
  }

  // Validate seasons and episodes
  if (show.startSeason <= 0 || show.startEpisode <= 0 || show.endSeason <= 0 || show.endEpisode <= 0) {
    setError('Season and episode numbers must be positive');
    return false;
  }

  if (show.endSeason < show.startSeason) {
    setError('End season cannot be less than start season');
    return false;
  }

  if (show.endSeason === show.startSeason && show.endEpisode < show.startEpisode) {
    setError('End episode cannot be less than start episode when in the same season');
    return false;
  }

  // All validations passed
  setError(null);
  return true;
} 