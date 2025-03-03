import { useState, useEffect, useCallback } from 'react';

type Log = {
  id: number;
  level: string;
  message: string;
  createdAt: string;
};

export function useLogStream() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Function to fetch initial logs
  const fetchInitialLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/logs');
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setLogs(data);
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

  useEffect(() => {
    // Fetch initial logs
    fetchInitialLogs();

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
            
            // Handle the new batch format
            if (data.type === 'logs_update' && Array.isArray(data.logs)) {
              setLogs(prevLogs => {
                const newLogs = [...prevLogs];
                
                // Add each new log if it doesn't already exist
                data.logs.forEach((newLog: Log) => {
                  if (!newLogs.some(log => log.id === newLog.id)) {
                    newLogs.unshift(newLog);
                  }
                });
                
                // Keep only the latest 100 logs
                return newLogs.slice(0, 100);
              });
            } 
            // Handle single log format (for backward compatibility)
            else if (data.id) {
              setLogs(prevLogs => {
                // Check if we already have this log (avoid duplicates)
                if (prevLogs.some(log => log.id === data.id)) {
                  return prevLogs;
                }
                return [data, ...prevLogs].slice(0, 100); // Keep only the latest 100 logs
              });
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
    
    return () => {
      if (eventSource) {
        eventSource.close();
        setIsConnected(false);
      }
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [fetchInitialLogs]);

  return { logs, isConnected, error, isLoading, clearLogs, refreshLogs: fetchInitialLogs };
} 