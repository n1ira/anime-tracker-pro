"use client";

import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { toast } from "sonner";

// Define types
export interface Show {
  id: number;
  title: string;
  status: string;
  lastScanned?: string;
  episodesPerSeason?: string;
  startSeason?: number;
  endSeason?: number;
}

interface ShowsContextType {
  shows: Show[];
  isLoading: boolean;
  error: string | null;
  refreshShows: () => Promise<void>;
}

// Create the context
const ShowsContext = createContext<ShowsContextType | undefined>(undefined);

// Provider component
export function ShowsProvider({ children }: { children: ReactNode }) {
  const [shows, setShows] = useState<Show[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShows = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/shows");
      
      if (!response.ok) {
        throw new Error(`Failed to fetch shows: ${response.statusText}`);
      }
      
      const data = await response.json();
      setShows(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch shows";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchShows();
  }, []);

  // Function to refresh shows
  const refreshShows = async () => {
    await fetchShows();
  };

  return (
    <ShowsContext.Provider value={{ shows, isLoading, error, refreshShows }}>
      {children}
    </ShowsContext.Provider>
  );
}

// Custom hook to use the shows context
export function useShows() {
  const context = useContext(ShowsContext);
  if (context === undefined) {
    throw new Error("useShows must be used within a ShowsProvider");
  }
  return context;
} 