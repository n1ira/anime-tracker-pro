import { useState, useEffect } from 'react';

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

  useEffect(() => {
    // Fetch initial logs
    fetch('/api/logs')
      .then(response => response.json())
      .then(data => {
        setLogs(data);
      })
      .catch(err => {
        console.error('Error fetching logs:', err);
        setError('Failed to fetch initial logs');
      });

    // Connect to SSE endpoint
    const eventSource = new EventSource('/api/logs/sse');

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const newLog = JSON.parse(event.data);
        if (newLog.id) {
          setLogs(prevLogs => [newLog, ...prevLogs].slice(0, 100)); // Keep only the latest 100 logs
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection to log stream lost. Reconnecting...');
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  return { logs, isConnected, error };
} 