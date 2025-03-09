"use client";

import { useState, useEffect, useCallback } from 'react';

type Log = {
  id: number;
  level: string;
  message: string;
  createdAt: string;
};

// Add a type for log summaries
type LogSummary = {
  id: string;
  timestamp: string;
  show: string;
  target: string;
  status: string;
  details: string;
};

export function useLogStream() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [summaries, setSummaries] = useState<LogSummary[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanActive, setIsScanActive] = useState(false);

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
        throw new Error(`Failed to clear logs: ${response.status} ${response.statusText}`);
      }
      
      // Clear logs in the UI immediately
      setLogs([]);
      setSummaries([]);
      setError(null);
      
      // Fetch logs again to ensure we have the latest state
      setTimeout(() => {
        fetchInitialLogs();
      }, 500); // Small delay to allow backend to process
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while clearing logs';
      console.error('Error clearing logs:', err);
      setError(errorMessage);
      return false;
    }
  }, [fetchInitialLogs]);

  // Function to check if scanning is active
  const checkScanningStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/scanner/status');
      if (!response.ok) {
        throw new Error(`Failed to fetch scanner status: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setIsScanActive(data.scanning || false);
      return data.scanning || false;
    } catch (err) {
      console.error('Error checking scanning status:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    // Fetch initial logs
    fetchInitialLogs();
    // Check scanning status initially
    checkScanningStatus();

    // Set up SSE connection
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    const connectSSE = () => {
      try {
        // Close existing connection if any
        if (eventSource) {
          eventSource.close();
        }
        
        // Connect to SSE endpoint
        eventSource = new EventSource('/api/logs/sse');
        
        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
          reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          console.log('Connected to log stream');
        };
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle the logs update format
            if (data.type === 'logs_update') {
              // Update logs
              if (Array.isArray(data.logs)) {
                setLogs(prevLogs => {
                  const newLogs = [...prevLogs];
                  
                  // Add each new log if it doesn't already exist
                  data.logs.forEach((newLog: Log) => {
                    if (!newLogs.some(log => log.id === newLog.id)) {
                      newLogs.push(newLog); // Add to the end for chronological display
                    }
                  });
                  
                  // Keep only the latest 100 logs
                  return newLogs.slice(-100);
                });
              }
              
              // Update summaries if they're included
              if (Array.isArray(data.summaries) && data.summaries.length > 0) {
                console.log("Received new summaries with logs:", data.summaries.length);
                setSummaries(data.summaries); // Replace with complete summary set
              }
            }
            // Handle summaries-only updates
            else if (data.type === 'summaries_update' && Array.isArray(data.summaries)) {
              console.log("Received summaries update:", data.summaries.length);
              setSummaries(data.summaries);
            }
            // Handle single log format (for backward compatibility)
            else if (data.id) {
              setLogs(prevLogs => {
                // Check if we already have this log (avoid duplicates)
                if (prevLogs.some(log => log.id === data.id)) {
                  return prevLogs;
                }
                return [...prevLogs, data].slice(-100); // Keep only the latest 100 logs, add to end
              });
              
              // For single logs, we might need to refresh summaries
              setTimeout(() => fetchInitialLogs(), 100);
            }
          } catch (err) {
            console.error('Error parsing SSE message:', err);
          }
        };
        
        eventSource.onerror = (e) => {
          console.error('SSE connection error:', e);
          setIsConnected(false);
          
          // Close the current connection
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          
          // Attempt to reconnect with exponential backoff
          reconnectAttempts++;
          if (reconnectAttempts <= maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
            setError(`Connection to log stream lost. Reconnecting in ${delay/1000} seconds... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
            
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
            }
            
            reconnectTimeout = setTimeout(() => {
              connectSSE();
            }, delay);
          } else {
            setError('Failed to connect to log stream after multiple attempts. Please refresh the page.');
          }
        };
      } catch (err) {
        console.error('Error setting up SSE connection:', err);
        setIsConnected(false);
        setError('Failed to connect to log stream');
      }
    };
    
    // Initial connection
    connectSSE();
    
    // Set up polling for scanning status
    const statusInterval = setInterval(() => {
      checkScanningStatus();
    }, 5000); // Check every 5 seconds
    
    return () => {
      if (eventSource) {
        eventSource.close();
        setIsConnected(false);
      }
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      clearInterval(statusInterval);
    };
  }, [fetchInitialLogs, checkScanningStatus]);

  return { 
    logs, 
    summaries, 
    isConnected, 
    error, 
    isLoading, 
    clearLogs, 
    refreshLogs: fetchInitialLogs,
    isScanActive,
    checkScanningStatus
  };
} 