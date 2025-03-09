'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useScanState } from '@/app/hooks/useScanState';

// Define the context type
type ScanContextType = ReturnType<typeof useScanState>;

// Create the context with a default value
const ScanContext = createContext<ScanContextType | undefined>(undefined);

// Provider component
export function ScanProvider({ children }: { children: ReactNode }) {
  const scanState = useScanState();

  return <ScanContext.Provider value={scanState}>{children}</ScanContext.Provider>;
}

// Custom hook to use the scan context
export function useScan() {
  const context = useContext(ScanContext);
  if (context === undefined) {
    throw new Error('useScan must be used within a ScanProvider');
  }
  return context;
}
