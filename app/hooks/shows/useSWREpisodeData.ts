'use client';

import useSWR, { useSWRConfig } from 'swr';
import { Episode } from './types';
import { fetcher } from '@/lib/swr-config';

// Key builder for SWR cache
const getEpisodesKey = (showId?: number) => (showId ? `/api/shows/${showId}/episodes` : null);
const getEpisodeKey = (showId?: number, episodeId?: number) =>
  showId && episodeId ? `/api/shows/${showId}/episodes/${episodeId}` : null;

/**
 * Hook for fetching episodes for a show with SWR caching
 */
export function useSWREpisodes(showId?: number) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: Episode[] }>(
    getEpisodesKey(showId),
    { revalidateOnFocus: false }
  );

  return {
    episodes: data?.data || [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

/**
 * Hook for fetching a single episode with SWR caching
 */
export function useSWREpisode(showId?: number, episodeId?: number) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: Episode }>(
    getEpisodeKey(showId, episodeId),
    { revalidateOnFocus: false }
  );

  return {
    episode: data?.data || null,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

/**
 * Hook for episode data mutations (update)
 */
export function useEpisodeMutations(showId?: number) {
  const { mutate } = useSWRConfig();

  // Update an episode
  const updateEpisode = async (episodeId: number, episodeData: Partial<Episode>) => {
    if (!showId) {
      return { success: false, error: 'Show ID is required' };
    }

    try {
      const response = await fetch(`/api/shows/${showId}/episodes/${episodeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(episodeData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update episode: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Revalidate both the individual episode and the episodes list
      mutate(getEpisodeKey(showId, episodeId));
      mutate(getEpisodesKey(showId));

      return { success: true, data: data.data };
    } catch (err: any) {
      console.error('Error updating episode:', err);
      return { success: false, error: err.message || 'Failed to update episode' };
    }
  };

  // Update multiple episodes
  const updateEpisodes = async (episodeUpdates: { id: number; data: Partial<Episode> }[]) => {
    if (!showId) {
      return { success: false, error: 'Show ID is required' };
    }

    try {
      // Process updates sequentially to avoid race conditions
      const results = [];
      for (const { id, data } of episodeUpdates) {
        const result = await updateEpisode(id, data);
        results.push(result);

        if (!result.success) {
          return { success: false, error: `Failed to update episode ${id}: ${result.error}` };
        }
      }

      return { success: true, results };
    } catch (err: any) {
      console.error('Error updating episodes:', err);
      return { success: false, error: err.message || 'Failed to update episodes' };
    }
  };

  return {
    updateEpisode,
    updateEpisodes,
  };
}
