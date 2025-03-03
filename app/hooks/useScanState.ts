import { useState, useEffect, useCallback } from 'react';

type Show = {
  id: number;
  title: string;
  [key: string]: any;
};

type ScanState = {
  id: number;
  isScanning: boolean;
  currentShowId: number | null;
  status: string;
  startedAt: string | null;
  updatedAt: string;
  currentShow: Show | null;
};

export function useScanState() {
  const [scanState, setScanState] = useState<ScanState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch the current scan state
  const fetchScanState = useCallback(async () => {
    try {
      const response = await fetch('/api/scan/status');
      if (!response.ok) {
        throw new Error('Failed to fetch scan state');
      }
      const data = await response.json();
      setScanState(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching scan state:', err);
      setError('Failed to fetch scan state');
    } finally {
      setLoading(false);
    }
  }, []);

  // Start a scan for a specific show or all shows
  const startScan = useCallback(async (showId?: number) => {
    try {
      setLoading(true);
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isScanning: true,
          currentShowId: showId || null,
          status: showId ? `Scanning show ${showId}` : 'Scanning all shows',
          action: 'start',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start scan');
      }

      await fetchScanState();
    } catch (err) {
      console.error('Error starting scan:', err);
      setError('Failed to start scan');
    } finally {
      setLoading(false);
    }
  }, [fetchScanState]);

  // Stop the current scan
  const stopScan = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scan/stop', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to stop scan');
      }

      await fetchScanState();
    } catch (err) {
      console.error('Error stopping scan:', err);
      setError('Failed to stop scan');
    } finally {
      setLoading(false);
    }
  }, [fetchScanState]);

  // Fetch scan state on component mount
  useEffect(() => {
    fetchScanState();

    // Poll for updates every 3 seconds
    const interval = setInterval(() => {
      if (scanState?.isScanning) {
        fetchScanState();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchScanState, scanState?.isScanning]);

  return {
    scanState,
    loading,
    error,
    startScan,
    stopScan,
    refreshScanState: fetchScanState,
  };
} 