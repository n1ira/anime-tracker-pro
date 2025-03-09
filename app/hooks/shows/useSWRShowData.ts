'use client';

import useSWR, { useSWRConfig } from 'swr';
import { Show } from './types';
import { fetcher } from '@/lib/swr-config';

// Key builder for SWR cache
const getShowKey = (id?: number) => (id ? `/api/shows/${id}` : null);
const getShowsKey = () => `/api/shows`;

/**
 * Hook for fetching a single show with SWR caching
 */
export function useSWRShow(id?: number) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: Show }>(getShowKey(id), {
    revalidateOnFocus: false,
  });

  return {
    show: data?.data || null,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

/**
 * Hook for fetching all shows with SWR caching
 */
export function useSWRShows() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: Show[] }>(getShowsKey(), {
    revalidateOnFocus: false,
  });

  return {
    shows: data?.data || [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

/**
 * Hook for show data mutations (create, update, delete)
 */
export function useShowMutations() {
  const { mutate } = useSWRConfig();

  // Create a new show
  const createShow = async (showData: Omit<Show, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch('/api/shows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(showData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create show: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Revalidate the shows list
      mutate(getShowsKey());

      return { success: true, data: data.data };
    } catch (err: any) {
      console.error('Error creating show:', err);
      return { success: false, error: err.message || 'Failed to create show' };
    }
  };

  // Update an existing show
  const updateShow = async (id: number, showData: Partial<Show>) => {
    try {
      const response = await fetch(`/api/shows/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(showData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update show: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Revalidate both the individual show and the shows list
      mutate(getShowKey(id));
      mutate(getShowsKey());

      return { success: true, data: data.data };
    } catch (err: any) {
      console.error('Error updating show:', err);
      return { success: false, error: err.message || 'Failed to update show' };
    }
  };

  // Delete a show
  const deleteShow = async (id: number) => {
    try {
      const response = await fetch(`/api/shows/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete show: ${response.status} ${response.statusText}`);
      }

      // Revalidate the shows list
      mutate(getShowsKey());

      return { success: true };
    } catch (err: any) {
      console.error('Error deleting show:', err);
      return { success: false, error: err.message || 'Failed to delete show' };
    }
  };

  return {
    createShow,
    updateShow,
    deleteShow,
  };
}
