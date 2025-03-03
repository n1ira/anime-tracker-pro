"use client";

import React, { useState } from 'react';
import { useLogStream } from '../hooks/useLogStream';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function LogViewer() {
  const { logs, isConnected, error, isLoading, clearLogs, refreshLogs } = useLogStream();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

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

  // Format the timestamp
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
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle>Logs</CardTitle>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <Badge variant="outline" className="bg-success/20 text-success">Connected</Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/20 text-destructive">Disconnected</Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshLogs}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Refresh</span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearDialogOpen(true)}
                className="ml-2"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Logs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {clearError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{clearError}</AlertDescription>
            </Alert>
          )}
          <ScrollArea className="h-[400px] rounded-md border p-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No logs available</div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="flex flex-col space-y-1 pb-2 border-b last:border-0">
                    <div className="flex justify-between items-center">
                      <Badge className={getLevelColor(log.level)}>
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all logs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearLogs}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clearLoading}
            >
              {clearLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Clearing...
                </>
              ) : (
                'Clear Logs'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 