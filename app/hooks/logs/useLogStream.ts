'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Log, LogSummary } from './types';
import { useLogFetch } from './useLogFetch';

export function useLogStream() {
  const {
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
  } = useLogFetch();

  const [isConnected, setIsConnected] = useState(false);
  const [isScanActive, setIsScanActive] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to connect to SSE
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/logs/sse');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log('SSE connection opened');
    };

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          setLogs(prevLogs => {
            // Only add if it doesn't already exist in our logs
            const exists = prevLogs.some(log => log.id === data.log.id);
            if (!exists) {
              return [data.log, ...prevLogs].slice(0, 1000); // Limit to 1000 entries
            }
            return prevLogs;
          });
        } else if (data.type === 'summary') {
          setSummaries(prevSummaries => {
            // Only add if it doesn't already exist in our summaries
            const exists = prevSummaries.some(sum => sum.id === data.summary.id);
            if (!exists) {
              return [data.summary, ...prevSummaries].slice(0, 50); // Limit to 50 summaries
            }
            return prevSummaries;
          });
        } else if (data.type === 'scan_status') {
          setIsScanActive(data.isScanning === true);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err, event.data);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      setIsConnected(false);
      eventSource.close();
      eventSourceRef.current = null;

      // Try to reconnect after a delay
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect SSE...');
        connectSSE();
      }, 5000);
    };
  }, [setLogs, setSummaries, setIsConnected, setError]);

  // Connect to SSE on mount, disconnect on unmount
  useEffect(() => {
    fetchInitialLogs();
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [fetchInitialLogs, connectSSE]);

  return {
    logs,
    summaries,
    isConnected,
    error,
    isLoading,
    isScanActive,
    clearLogs,
  };
}
