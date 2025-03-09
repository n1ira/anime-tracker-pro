"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useLogStream } from "@/app/hooks/useLogStream";

// Define the context type
type LogsContextType = ReturnType<typeof useLogStream>;

// Create the context with a default value
const LogsContext = createContext<LogsContextType | undefined>(undefined);

// Provider component
export function LogsProvider({ children }: { children: ReactNode }) {
  const logsState = useLogStream();

  return (
    <LogsContext.Provider value={logsState}>
      {children}
    </LogsContext.Provider>
  );
}

// Custom hook to use the logs context
export function useLogs() {
  const context = useContext(LogsContext);
  if (context === undefined) {
    throw new Error("useLogs must be used within a LogsProvider");
  }
  return context;
} 