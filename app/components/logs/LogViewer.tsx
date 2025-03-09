"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLogStream } from '../../hooks/useLogStream';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { LogFilterControls } from './LogFilterControls';
import { LogEntry } from './LogEntry';

// Define the Log interface to match what's coming from useLogStream
interface Log {
  id: number;
  timestamp: string;
  level: string;
  message: string;
  context?: string;
}

// Define the LogSummary interface to match what's coming from useLogStream
interface LogSummary {
  status: string;
  count: number;
  lastUpdated: string;
}

export function LogViewer() {
  const { logs, summaries, isConnected, error, isLoading, clearLogs, refreshLogs, isScanActive, checkScanningStatus } = useLogStream();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("summary");
  
  // References for scrolling
  const detailsContainerRef = useRef<HTMLDivElement>(null);
  const detailsBottomRef = useRef<HTMLDivElement>(null);
  const summaryTopRef = useRef<HTMLDivElement>(null);
  
  // Sort logs in chronological order (oldest first)
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      // Ensure we're working with the correct type
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return aTime - bTime;
    });
  }, [logs]);
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (activeTab === "details" && detailsBottomRef.current) {
      detailsBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);
  
  // Scroll to top of summary when switching to summary tab
  useEffect(() => {
    if (activeTab === "summary" && summaryTopRef.current) {
      summaryTopRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab]);
  
  // Check scanning status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      checkScanningStatus();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [checkScanningStatus]);

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'info':
        return 'text-blue-500 dark:text-blue-400';
      case 'warn':
        return 'text-yellow-500 dark:text-yellow-400';
      case 'error':
        return 'text-red-500 dark:text-red-400';
      case 'debug':
        return 'text-purple-500 dark:text-purple-400';
      case 'success':
        return 'text-green-500 dark:text-green-400';
      case 'failure':
        return 'text-red-500 dark:text-red-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleClearLogs = async () => {
    try {
      setClearLoading(true);
      setClearError(null);
      
      const response = await fetch('/api/logs', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear logs');
      }
      
      // Refresh logs after clearing
      clearLogs();
      setClearDialogOpen(false);
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setClearLoading(false);
    }
  };

  const handleRefreshLogs = () => {
    refreshLogs();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'failure':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'scanning':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b">
        <div className="flex justify-between items-center">
          <CardTitle>Logs</CardTitle>
          <div className="flex items-center space-x-2">
            {isScanActive && (
              <div className="text-sm text-blue-500 dark:text-blue-400 flex items-center">
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Scan in progress
              </div>
            )}
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs defaultValue="summary" value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b px-4 py-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
          </div>
          
          <div className="p-4">
            <LogFilterControls
              onClearLogs={handleClearLogs}
              onRefreshLogs={handleRefreshLogs}
              clearLoading={clearLoading}
              clearError={clearError}
              setClearDialogOpen={setClearDialogOpen}
            />
            
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <TabsContent value="summary" className="mt-0">
              <div ref={summaryTopRef}></div>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : summaries.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No log summaries available.
                </div>
              ) : (
                <div className="space-y-4">
                  {summaries.map((summary, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-md ${getStatusColor(summary.status)}`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="font-medium capitalize">{summary.status}</div>
                        <div className="text-sm">{formatTimestamp(summary.lastUpdated)}</div>
                      </div>
                      <div className="mt-1 text-sm">
                        {summary.count} {summary.count === 1 ? 'entry' : 'entries'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="details" className="mt-0">
              <div ref={detailsContainerRef}>
                <ScrollArea className="h-[500px] rounded-md border">
                  {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : sortedLogs.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No logs available.
                    </div>
                  ) : (
                    <div>
                      {sortedLogs.map((log) => (
                        <LogEntry
                          key={log.id}
                          log={log}
                          formatTimestamp={formatTimestamp}
                          getLevelColor={getLevelColor}
                        />
                      ))}
                      <div ref={detailsBottomRef}></div>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
} 