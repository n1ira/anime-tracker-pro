'use client';

import { useScanStatus } from './useScanStatus';
import { useScanControl } from './useScanControl';

export function useScanState() {
  const { scanState, loading, error, fetchScanState, startPolling, stopPolling } = useScanStatus();

  const {
    isStartingScanner,
    isStoppingScanner,
    statusMessage,
    startShowScan,
    startAllShowsScan,
    stopScan,
    clearStatusMessage,
  } = useScanControl();

  return {
    // State
    scanState,
    loading,
    error,
    statusMessage,
    isStartingScanner,
    isStoppingScanner,
    isScanning: scanState?.isScanning || false,
    currentShowId: scanState?.currentShowId || null,
    currentShow: scanState?.currentShow || null,
    scanStatus: scanState?.status || 'Idle',

    // Status actions
    fetchScanState,
    startPolling,
    stopPolling,

    // Control actions
    startShowScan,
    startAllShowsScan,
    stopScan,
    clearStatusMessage,
  };
}
