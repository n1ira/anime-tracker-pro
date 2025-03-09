'use client';

import { useState, useCallback } from 'react';
import { Log, LogSummary } from './types';

export function useLogFetch() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [summaries, setSummaries] = useState<LogSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch initial logs
  const fetchInitialLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/logs');
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setLogs(data.logs || data); // Handle both new and old formats
      setSummaries(data.summary || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Failed to fetch initial logs. Please try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to clear logs
  const clearLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/logs', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to clear logs');
      }
      setLogs([]);
      setSummaries([]);
      setError(null);
    } catch (err) {
      console.error('Error clearing logs:', err);
      setError('Failed to clear logs. Please try again later.');
    }
  }, []);

  return {
    logs,
    setLogs,
    summaries,
    setSummaries,
    isLoading,
    setIsLoading,
    error,
    setError,
    fetchInitialLogs,
    clearLogs,
  };
}
