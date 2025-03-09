"use client";

import { useState, useCallback } from 'react';
import { ScanResult } from './types';

export function useScanControl() {
  const [isStartingScanner, setIsStartingScanner] = useState(false);
  const [isStoppingScanner, setIsStoppingScanner] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Start scan for a specific show
  const startShowScan = useCallback(async (showId: number): Promise<ScanResult> => {
    setIsStartingScanner(true);
    setStatusMessage('Starting scan...');
    
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ showId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to start scan');
      }
      
      setStatusMessage('Scan started successfully');
      return { success: true, message: 'Scan started successfully' };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to start scan';
      console.error('Error starting scan:', errorMessage);
      setStatusMessage(`Error: ${errorMessage}`);
      return { success: false, message: errorMessage };
    } finally {
      setIsStartingScanner(false);
    }
  }, []);

  // Start scan for all shows
  const startAllShowsScan = useCallback(async (): Promise<ScanResult> => {
    setIsStartingScanner(true);
    setStatusMessage('Starting scan for all shows...');
    
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scanAll: true }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to start scan for all shows');
      }
      
      setStatusMessage('Scan started successfully for all shows');
      return { success: true, message: 'Scan started successfully for all shows' };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to start scan for all shows';
      console.error('Error starting scan for all shows:', errorMessage);
      setStatusMessage(`Error: ${errorMessage}`);
      return { success: false, message: errorMessage };
    } finally {
      setIsStartingScanner(false);
    }
  }, []);

  // Stop ongoing scan
  const stopScan = useCallback(async (): Promise<ScanResult> => {
    setIsStoppingScanner(true);
    setStatusMessage('Stopping scan...');
    
    try {
      const response = await fetch('/api/scan/stop', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to stop scan');
      }
      
      setStatusMessage('Scan stopped successfully');
      return { success: true, message: 'Scan stopped successfully' };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to stop scan';
      console.error('Error stopping scan:', errorMessage);
      setStatusMessage(`Error: ${errorMessage}`);
      return { success: false, message: errorMessage };
    } finally {
      setIsStoppingScanner(false);
    }
  }, []);

  // Clear status message
  const clearStatusMessage = useCallback(() => {
    setStatusMessage(null);
  }, []);

  return {
    isStartingScanner,
    isStoppingScanner,
    statusMessage,
    startShowScan,
    startAllShowsScan,
    stopScan,
    clearStatusMessage,
  };
} 