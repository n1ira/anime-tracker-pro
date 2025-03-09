'use client';

import { useState, useEffect, useCallback } from 'react';
import { Show } from './types';

export function useShowData(showId?: number) {
  const [show, setShow] = useState<Show | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch a single show by ID
  const fetchShow = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/shows/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch show: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setShow(data.data || null);
      setError(null);
    } catch (err) {
      console.error('Error fetching show:', err);
      setError('Failed to fetch show data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all shows
  const fetchShows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/shows');
      if (!response.ok) {
        throw new Error(`Failed to fetch shows: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setShows(data.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching shows:', err);
      setError('Failed to fetch shows. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new show
  const createShow = useCallback(async (showData: Omit<Show, 'id' | 'createdAt' | 'updatedAt'>) => {
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
      return { success: true, data: data.data };
    } catch (err: any) {
      console.error('Error creating show:', err);
      return { success: false, error: err.message || 'Failed to create show' };
    }
  }, []);

  // Update an existing show
  const updateShow = useCallback(async (id: number, showData: Partial<Show>) => {
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
      return { success: true, data: data.data };
    } catch (err: any) {
      console.error('Error updating show:', err);
      return { success: false, error: err.message || 'Failed to update show' };
    }
  }, []);

  // Delete a show
  const deleteShow = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/shows/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete show: ${response.status} ${response.statusText}`);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error deleting show:', err);
      return { success: false, error: err.message || 'Failed to delete show' };
    }
  }, []);

  // Fetch initial data if showId is provided
  useEffect(() => {
    if (showId) {
      fetchShow(showId);
    } else {
      fetchShows();
    }
  }, [showId, fetchShow, fetchShows]);

  return {
    show,
    shows,
    loading,
    error,
    fetchShow,
    fetchShows,
    createShow,
    updateShow,
    deleteShow,
  };
}
