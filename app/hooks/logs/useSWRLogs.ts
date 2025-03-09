'use client';

import useSWR from 'swr';
import { useState, useCallback } from 'react';
import { fetcher } from '@/lib/swr-config';

// Types for logs
interface Log {
  id: number;
  message: string;
  level: string;
  timestamp: string;
  showId?: number;
  showTitle?: string;
}

interface LogsResponse {
  data: Log[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// Key builder for SWR cache
const getLogsKey = (page: number, pageSize: number, level?: string, showId?: number) => {
  let key = `/api/logs?page=${page}&pageSize=${pageSize}`;
  if (level) key += `&level=${level}`;
  if (showId) key += `&showId=${showId}`;
  return key;
};

/**
 * Hook for fetching logs with SWR caching and pagination
 */
export function useSWRLogs(initialPage = 1, initialPageSize = 50) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [level, setLevel] = useState<string | undefined>(undefined);
  const [showId, setShowId] = useState<number | undefined>(undefined);

  const { data, error, isLoading, isValidating, mutate } = useSWR<LogsResponse>(
    getLogsKey(page, pageSize, level, showId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000, // Dedupe requests with the same key in this time span
    }
  );

  // Navigate to a specific page
  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // Change page size
  const changePageSize = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  }, []);

  // Filter by log level
  const filterByLevel = useCallback((newLevel?: string) => {
    setLevel(newLevel);
    setPage(1); // Reset to first page when changing filter
  }, []);

  // Filter by show ID
  const filterByShowId = useCallback((newShowId?: number) => {
    setShowId(newShowId);
    setPage(1); // Reset to first page when changing filter
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setLevel(undefined);
    setShowId(undefined);
    setPage(1); // Reset to first page when clearing filters
  }, []);

  // Refresh logs data
  const refreshLogs = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    logs: data?.data || [],
    pagination: data?.pagination || { total: 0, page, pageSize, totalPages: 0 },
    isLoading,
    isValidating,
    error,
    filters: {
      level,
      showId,
    },
    goToPage,
    changePageSize,
    filterByLevel,
    filterByShowId,
    clearFilters,
    refreshLogs,
  };
}
