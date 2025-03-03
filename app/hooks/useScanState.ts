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
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        // Check if scan state has changed
        if (lastScanStateRef.current?.isScanning !== data.isScanning) {
          console.log('DEBUG: Scan state changed in frontend:', 
            lastScanStateRef.current?.isScanning, '->', data.isScanning,
            'status:', data.status);
        }
        
        // Update the last scan state ref
        lastScanStateRef.current = data;
        
        setScanState(data);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching scan state:', err);
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        setError('Failed to fetch scan state');
      }
    } finally {
      // Only update state if component is still mounted
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Start a scan for a specific show or all shows
  const startScan = useCallback(async (showId?: number) => {
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
          status: showId ? `Scanning show ${showId}` : 'Scanning all shows',
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
  }, [fetchScanState]);

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
    
    // Always poll, but at different rates depending on scanning state
    // Use a shorter polling interval during scanning to ensure we catch state changes quickly
    const pollInterval = scanState?.isScanning ? 500 : 2000; // Poll every 500ms during scanning, 2 seconds otherwise
    
    console.log('DEBUG: Setting up polling interval:', pollInterval, 'ms, isScanning:', scanState?.isScanning);
    
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