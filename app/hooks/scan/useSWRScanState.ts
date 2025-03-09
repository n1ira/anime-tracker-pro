'use client';

import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { fetcher } from '@/lib/swr-config';

// Types for scan state
interface ScanState {
  isScanning: boolean;
  currentShow: string | null;
  progress: number;
  totalShows: number;
  completedShows: number;
}

// Key builder for SWR cache
const getScanStatusKey = () => `/api/scan/status`;

/**
 * Hook for fetching scan status with SWR caching
 */
export function useSWRScanStatus() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: ScanState }>(
    getScanStatusKey(),
    {
      refreshInterval: 2000, // Poll every 2 seconds when active
      revalidateOnFocus: true,
      dedupingInterval: 1000, // Dedupe requests with the same key in this time span
    }
  );

  return {
    scanState: data?.data || {
      isScanning: false,
      currentShow: null,
      progress: 0,
      totalShows: 0,
      completedShows: 0,
    },
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

/**
 * Hook for scan control operations
 */
export function useScanControl() {
  const { mutate } = useSWRConfig();

  // Start scanning all shows
  const startScan = async () => {
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to start scan: ${response.status} ${response.statusText}`);
      }

      // Revalidate scan status
      mutate(getScanStatusKey());

      toast.success('Scan started successfully');
      return { success: true };
    } catch (err: any) {
      console.error('Error starting scan:', err);
      toast.error(`Failed to start scan: ${err.message}`);
      return { success: false, error: err.message || 'Failed to start scan' };
    }
  };

  // Start scanning a specific show
  const startSingleShowScan = async (showId: number) => {
    try {
      const response = await fetch(`/api/scan?showId=${showId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to start scan: ${response.status} ${response.statusText}`);
      }

      // Revalidate scan status
      mutate(getScanStatusKey());

      toast.success('Show scan started successfully');
      return { success: true };
    } catch (err: any) {
      console.error('Error starting show scan:', err);
      toast.error(`Failed to start show scan: ${err.message}`);
      return { success: false, error: err.message || 'Failed to start show scan' };
    }
  };

  // Stop the current scan
  const stopScan = async () => {
    try {
      const response = await fetch('/api/stop', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to stop scan: ${response.status} ${response.statusText}`);
      }

      // Revalidate scan status
      mutate(getScanStatusKey());

      toast.success('Scan stopped successfully');
      return { success: true };
    } catch (err: any) {
      console.error('Error stopping scan:', err);
      toast.error(`Failed to stop scan: ${err.message}`);
      return { success: false, error: err.message || 'Failed to stop scan' };
    }
  };

  return {
    startScan,
    startSingleShowScan,
    stopScan,
  };
}
