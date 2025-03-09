"use client";

import { SWRConfig } from 'swr';
import React from 'react';

// Default fetcher for SWR
export const fetcher = async (url: string) => {
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = new Error('An error occurred while fetching the data.');
    // Add extra info to the error object
    (error as any).info = await response.json();
    (error as any).status = response.status;
    throw error;
  }
  
  return response.json();
};

// Global SWR configuration
export const swrConfig = {
  // Don't include the fetcher in the config object
  // It will be provided directly in the SWRProvider component
  revalidateOnFocus: false, // Don't revalidate on window focus
  revalidateOnReconnect: true, // Revalidate when browser regains connection
  refreshInterval: 0, // No automatic polling by default
  shouldRetryOnError: true, // Retry on error
  dedupingInterval: 2000, // Dedupe requests with the same key in this time span
  errorRetryCount: 3, // Retry 3 times on failure
  errorRetryInterval: 5000, // Starting retry interval (increases with each retry)
  suspense: false, // Don't use React Suspense by default
};

// SWR Provider component for wrapping the app
export function SWRProvider({ children }: { children: React.ReactNode }) {
  // Provide the fetcher function directly in the component
  return <SWRConfig value={{ ...swrConfig, fetcher }}>{children}</SWRConfig>;
} 