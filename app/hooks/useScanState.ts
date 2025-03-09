'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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

  // Use a ref to track if the component is mounted
  const isMounted = useRef(true);

  // Use a ref to store the polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use a ref to track the last scan state for debugging
  const lastScanStateRef = useRef<ScanState | null>(null);

  // Function to fetch the current scan state
  const fetchScanState = useCallback(async () => {
    // Don't fetch if component is unmounted
    if (!isMounted.current) return;

    try {
      const response = await fetch('/api/scan/status');
      if (!response.ok) {
        throw new Error('Failed to fetch scan state');
      }
      const data = await response.json();

      // Make sure data is valid
      if (!data || !data.data) {
        throw new Error('Invalid scan state data from API');
      }

      // Ensure we have a default status if none provided
      const scanData = {
        ...data.data,
        status: data.data.status || 'idle',
      };

      // Only update state if component is still mounted
      if (isMounted.current) {
        // Check if scan state has changed significantly to avoid console spam
        if (
          lastScanStateRef.current?.isScanning !== scanData.isScanning ||
          lastScanStateRef.current?.status !== scanData.status ||
          lastScanStateRef.current?.currentShowId !== scanData.currentShowId
        ) {
          console.log(
            'DEBUG: Scan state changed in frontend:',
            'isScanning:',
            lastScanStateRef.current?.isScanning,
            '->',
            scanData.isScanning,
            'status:',
            scanData.status,
            'currentShowId:',
            scanData.currentShowId,
            'currentShow:',
            scanData.currentShow ? scanData.currentShow.title : 'null'
          );
        }

        // Update the last scan state ref
        lastScanStateRef.current = scanData;

        setScanState(scanData);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching scan state:', err);

      // Only update state if component is still mounted
      if (isMounted.current) {
        setError('Failed to fetch scan state');

        // Set a default scan state if we couldn't fetch one
        if (!scanState) {
          setScanState({
            id: 0,
            isScanning: false,
            status: 'idle',
            currentShowId: null,
            startedAt: null,
            updatedAt: new Date().toISOString(),
            currentShow: null,
          });
        }
      }
    } finally {
      // Only update state if component is still mounted
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [scanState]);

  // Start a scan for a specific show or all shows
  const startScan = useCallback(
    async (showId?: number) => {
      if (!isMounted.current) return;

      try {
        setLoading(true);
        console.log('DEBUG: Starting scan, showId:', showId);

        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isScanning: true,
            currentShowId: showId || null,
            status: showId ? `Scanning show ID: ${showId}` : 'Scanning all shows',
            action: 'start',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to start scan');
        }

        const data = await response.json();
        console.log('DEBUG: Scan started response:', JSON.stringify(data));

        await fetchScanState();
      } catch (err) {
        console.error('Error starting scan:', err);

        if (isMounted.current) {
          setError('Failed to start scan');
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [fetchScanState]
  );

  // Stop the current scan
  const stopScan = useCallback(async () => {
    if (!isMounted.current) return;

    try {
      setLoading(true);
      console.log('DEBUG: Stopping scan');

      const response = await fetch('/api/scan/stop', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to stop scan');
      }

      const data = await response.json();
      console.log('DEBUG: Scan stopped response:', JSON.stringify(data));

      await fetchScanState();
    } catch (err) {
      console.error('Error stopping scan:', err);

      if (isMounted.current) {
        setError('Failed to stop scan');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [fetchScanState]);

  // Setup and cleanup polling
  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;

    // Initial fetch
    fetchScanState();

    // Cleanup function
    return () => {
      // Set unmounted flag
      isMounted.current = false;

      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [fetchScanState]);

  // Setup polling when scan state changes
  useEffect(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Use different polling intervals depending on scanning state
    // More frequent during scanning, much less frequent when idle
    const pollInterval = scanState?.isScanning ? 1000 : 5000; // 1s during scanning, 5s when idle

    // Debug log for polling interval changes, not for each poll
    if (lastScanStateRef.current?.isScanning !== scanState?.isScanning) {
      console.log(
        'DEBUG: Setting up polling interval:',
        pollInterval,
        'ms, isScanning:',
        scanState?.isScanning
      );
    }

    pollingIntervalRef.current = setInterval(() => {
      fetchScanState();
    }, pollInterval);

    // Cleanup function
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [scanState?.isScanning, fetchScanState]);

  return {
    scanState,
    loading,
    error,
    startScan,
    stopScan,
    refreshScanState: fetchScanState,
  };
}
