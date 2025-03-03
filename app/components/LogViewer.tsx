import React from 'react';
import { useLogStream } from '../hooks/useLogStream';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function LogViewer() {
  const { logs, isConnected, error } = useLogStream();

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

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle>Logs</CardTitle>
          {isConnected ? (
            <Badge variant="outline" className="bg-success/20 text-success">Connected</Badge>
          ) : (
            <Badge variant="outline" className="bg-destructive/20 text-destructive">Disconnected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <ScrollArea className="h-[400px] rounded-md border p-4">
          {logs.length === 0 ? (
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
  );
} 