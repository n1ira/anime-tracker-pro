"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLogStream } from '../hooks/useLogStream';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { 
  AlertCircle, 
  Trash2, 
  Loader2, 
  List, 
  Rows, 
  CheckCircle2, 
  Clock, 
  Download, 
  Search, 
  XCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

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
    return logs && logs.length > 0
      ? [...logs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      : [];
  }, [logs]);
  
  // Sort summaries by timestamp in reverse chronological order
  const sortedSummaries = useMemo(() => {
    return summaries && summaries.length > 0 
      ? [...summaries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      : [];
  }, [summaries]);

  // Auto-scroll when logs are updated (only if scan is active)
  useEffect(() => {
    if (logs.length > 0 && isScanActive) {
      // Scroll to bottom when details tab is active to see newest logs at the end
      if (detailsBottomRef.current && detailsContainerRef.current && activeTab === "details") {
        // Use scrollIntoView on the bottom element within the container
        detailsBottomRef.current.scrollIntoView({ 
          behavior: "smooth", 
          block: "end", 
          inline: "nearest" 
        });
      }
    }
  }, [logs, activeTab, isScanActive]);
  
  // Auto-scroll summaries only when there are new ones and scan is active
  useEffect(() => {
    if (summaries.length > 0 && isScanActive) {
      // Scroll to top when summary tab is active to see newest summaries at the top
      if (summaryTopRef.current && activeTab === "summary") {
        summaryTopRef.current.scrollIntoView({ 
          behavior: "smooth", 
          block: "start", 
          inline: "nearest" 
        });
      }
    }
  }, [summaries, activeTab, isScanActive]);

  // Function to get the appropriate color for the log level
  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'bg-destructive text-destructive-foreground';
      case 'warning':
        return 'bg-warning text-warning-foreground';
      case 'success':
        return 'bg-success text-success-foreground';
      case 'info':
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  // Format timestamp to a readable format
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const handleClearLogs = async () => {
    setClearLoading(true);
    setClearError(null);
    
    try {
      const success = await clearLogs();
      
      if (success) {
        setClearDialogOpen(false);
      } else {
        setClearError('Failed to clear logs. Please try again.');
      }
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error clearing logs:', err);
    } finally {
      setClearLoading(false);
    }
  };

  const handleRefreshLogs = () => {
    refreshLogs();
    checkScanningStatus(); // Also check the scanning status when refreshing
  };

  // Function to get icon and color for summary status
  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('download') || statusLower.includes('found')) {
      return {
        color: 'text-success',
        icon: <Download className="h-4 w-4 mr-1" />
      };
    } else if (statusLower.includes('not found') || statusLower === 'failed') {
      return {
        color: 'text-destructive',
        icon: <XCircle className="h-4 w-4 mr-1" />
      };
    } else if (statusLower.includes('progress') || statusLower === 'in progress') {
      return {
        color: 'text-blue-500',
        icon: <Clock className="h-4 w-4 mr-1" />
      };
    } else if (statusLower.includes('complet')) {
      return {
        color: 'text-green-600',
        icon: <CheckCircle2 className="h-4 w-4 mr-1" />
      };
    } else if (statusLower.includes('search')) {
      return {
        color: 'text-amber-500',
        icon: <Search className="h-4 w-4 mr-1" />
      };
    } else {
      return {
        color: 'text-muted-foreground',
        icon: <AlertCircle className="h-4 w-4 mr-1" />
      };
    }
  };

  return (
    <Card className="min-h-[calc(100vh-220px)] shadow-md">
      <CardHeader className="border-b bg-muted/20 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CardTitle className="mr-2">Scanner Logs</CardTitle>
            {isScanActive && (
              <Badge 
                variant="outline" 
                className="bg-blue-100 text-blue-800 border-blue-300 px-2 py-0 h-6 animate-pulse"
              >
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Scanning
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              variant={isConnected ? "success" : "destructive"}
              className="px-2 py-0 h-6"
            >
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefreshLogs}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setClearDialogOpen(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="summary" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b px-4">
            <TabsList className="bg-transparent h-10">
              <TabsTrigger value="summary" className="data-[state=active]:bg-muted/50">
                <List className="h-4 w-4 mr-2" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="details" className="data-[state=active]:bg-muted/50">
                <Rows className="h-4 w-4 mr-2" />
                Details
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="summary" className="p-4 h-[calc(100vh-300px)] overflow-auto">
            <div ref={summaryTopRef} className="h-1" />
            
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {sortedSummaries && sortedSummaries.length > 0 ? (
              <div className="space-y-4">
                {sortedSummaries.map((summary) => {
                  const { color, icon } = getStatusColor(summary.status);
                  return (
                    <div 
                      key={summary.id} 
                      className="p-4 rounded-md border bg-card shadow-sm hover:shadow transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center text-lg font-medium">
                          {summary.show || 'Unknown Show'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatTimestamp(summary.timestamp)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Target:</span>{' '}
                          {summary.target !== 'Unknown' ? summary.target : 'Not specified'}
                        </div>
                        
                        <div className="flex items-center">
                          <span className="text-muted-foreground mr-1">Status:</span>
                          <span className={`flex items-center ${color}`}>
                            {icon} {summary.status}
                          </span>
                        </div>
                        
                        {summary.details && (
                          <div className="col-span-2 mt-1 text-sm text-muted-foreground">
                            {summary.details}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Search className="h-12 w-12 mb-4 opacity-20" />
                <p>No scan summaries available</p>
                <p className="text-sm">Run a scan to see results here</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="details" className="h-[calc(100vh-300px)] overflow-auto space-y-2 p-4" ref={detailsContainerRef}>
            {sortedLogs && sortedLogs.length > 0 ? (
              <>
                {sortedLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-start space-x-2 py-1.5 border-b last:border-0"
                  >
                    <Badge 
                      className={cn("shrink-0", getLevelColor(log.level))}
                    >
                      {log.level.toUpperCase()}
                    </Badge>
                    <div className="text-sm text-muted-foreground shrink-0 w-20">
                      {formatTimestamp(log.createdAt)}
                    </div>
                    <div className="text-sm break-words flex-1">
                      {log.message}
                    </div>
                  </div>
                ))}
                <div ref={detailsBottomRef} className="h-1" />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                <p>No logs available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Logs</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all scanner logs. This action cannot be undone.
              {clearError && (
                <div className="mt-2 text-destructive">{clearError}</div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearLogs}
              disabled={clearLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearLoading ? 'Clearing...' : 'Clear Logs'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// Fallback icon for search results
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
} 