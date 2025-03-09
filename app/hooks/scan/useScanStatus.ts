"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { ScanState } from './types';

export function useScanStatus() {
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
      
      // Update the state and ref
      setScanState(data.data);
      lastScanStateRef.current = data.data;
      setError(null);
    } catch (err) {
      console.error('Error fetching scan state:', err);
      setError('Failed to fetch scan status');
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Start polling for scan state
  const startPolling = useCallback((interval = 2000) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Fetch immediately
    fetchScanState();
    
    // Then start polling
    pollingIntervalRef.current = setInterval(() => {
      fetchScanState();
    }, interval);
  }, [fetchScanState]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Initialize on mount and clean up on unmount
  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;
    
    // Fetch initial scan state
    fetchScanState();
    
    // Start polling if scan is in progress
    if (scanState?.isScanning) {
      startPolling();
    }
    
    // Cleanup function
    return () => {
      isMounted.current = false;
      stopPolling();
    };
  }, [fetchScanState, startPolling, stopPolling, scanState?.isScanning]);

  // Start/stop polling when isScanning changes
  useEffect(() => {
    if (scanState?.isScanning) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [scanState?.isScanning, startPolling, stopPolling]);

  return {
    scanState,
    loading,
    error,
    fetchScanState,
    startPolling,
    stopPolling,
  };
} 