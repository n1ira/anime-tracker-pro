'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Episode } from './types';

export function useEpisodeData(showId: number) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({});

  // Group episodes by season
  const episodesBySeason = useMemo(() => {
    const grouped: Record<number, Episode[]> = {};

    episodes.forEach(episode => {
      const season = episode.season;
      if (!grouped[season]) {
        grouped[season] = [];
      }
      grouped[season].push(episode);
    });

    // Sort episodes within each season
    Object.keys(grouped).forEach(season => {
      grouped[parseInt(season)].sort((a, b) => a.episode - b.episode);
    });

    return grouped;
  }, [episodes]);

  // Get seasons list sorted
  const seasons = useMemo(() => {
    return Object.keys(episodesBySeason)
      .map(season => parseInt(season))
      .sort((a, b) => a - b);
  }, [episodesBySeason]);

  // Calculate watch progress for each season
  const seasonProgress = useMemo(() => {
    const progress: Record<number, { watched: number; total: number }> = {};

    seasons.forEach(season => {
      const seasonEpisodes = episodesBySeason[season];
      const watched = seasonEpisodes.filter(ep => ep.isWatched).length;
      progress[season] = {
        watched,
        total: seasonEpisodes.length,
      };
    });

    return progress;
  }, [seasons, episodesBySeason]);

  // Fetch episodes for a show
  const fetchEpisodes = useCallback(async () => {
    if (!showId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/shows/${showId}/episodes`);
      if (!response.ok) {
        throw new Error(`Failed to fetch episodes: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setEpisodes(data.data || []);

      // Initialize expanded seasons
      const episodeData: Episode[] = data.data || [];
      const seasons: number[] = [...new Set(episodeData.map(ep => ep.season))];
      const initialExpandedState: Record<number, boolean> = {};
      seasons.forEach(season => {
        initialExpandedState[season] = true; // Default to expanded
      });
      setExpandedSeasons(initialExpandedState);

      setError(null);
    } catch (err) {
      console.error('Error fetching episodes:', err);
      setError('Failed to fetch episodes. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, [showId]);

  // Toggle episode watched status
  const toggleEpisodeStatus = useCallback(
    async (episodeId: number, isWatched: boolean) => {
      try {
        const response = await fetch(`/api/shows/${showId}/episodes/${episodeId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isWatched }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update episode: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Update local state
        setEpisodes(prev => prev.map(ep => (ep.id === episodeId ? { ...ep, isWatched } : ep)));

        return { success: true, data: data.data };
      } catch (err: any) {
        console.error('Error updating episode:', err);
        return { success: false, error: err.message || 'Failed to update episode' };
      }
    },
    [showId]
  );

  // Toggle season collapse state
  const toggleSeasonCollapse = useCallback((season: number) => {
    setExpandedSeasons(prev => ({
      ...prev,
      [season]: !prev[season],
    }));
  }, []);

  // Expand all seasons
  const expandAllSeasons = useCallback(() => {
    const expanded: Record<number, boolean> = {};
    seasons.forEach(season => {
      expanded[season] = true;
    });
    setExpandedSeasons(expanded);
  }, [seasons]);

  // Collapse all seasons
  const collapseAllSeasons = useCallback(() => {
    const collapsed: Record<number, boolean> = {};
    seasons.forEach(season => {
      collapsed[season] = false;
    });
    setExpandedSeasons(collapsed);
  }, [seasons]);

  // Fetch episodes on mount
  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  return {
    episodes,
    episodesBySeason,
    seasons,
    seasonProgress,
    expandedSeasons,
    loading,
    error,
    fetchEpisodes,
    toggleEpisodeStatus,
    toggleSeasonCollapse,
    expandAllSeasons,
    collapseAllSeasons,
  };
}
