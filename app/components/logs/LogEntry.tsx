import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Download, Search, XCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

interface Log {
  id: number;
  timestamp: string;
  level: string;
  message: string;
  context?: string;
}

interface LogEntryProps {
  log: Log;
  formatTimestamp: (timestamp: string) => string;
  getLevelColor: (level: string) => string;
}

export function LogEntry({ log, formatTimestamp, getLevelColor }: LogEntryProps) {
  const levelColor = getLevelColor(log.level);
  
  // Parse context if available
  let context: any = null;
  if (log.context) {
    try {
      context = JSON.parse(log.context);
    } catch (e) {
      // If not valid JSON, use as is
      context = log.context;
    }
  }
  
  return (
    <div className={cn(
      "p-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors",
      log.level === 'error' && "bg-red-50 dark:bg-red-900/10"
    )}>
      <div className="flex items-start">
        <div className={`mr-2 mt-0.5 ${levelColor}`}>
          {log.level === 'info' && <CheckCircle2 className="h-4 w-4" />}
          {log.level === 'warn' && <Clock className="h-4 w-4" />}
          {log.level === 'error' && <AlertCircle className="h-4 w-4" />}
          {log.level === 'debug' && <Search className="h-4 w-4" />}
          {log.level === 'success' && <Download className="h-4 w-4" />}
          {log.level === 'failure' && <XCircle className="h-4 w-4" />}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <span className={`text-xs font-medium ${levelColor}`}>
              {log.level.toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(log.timestamp)}
            </span>
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap">{log.message}</p>
          
          {context && typeof context === 'object' && (
            <div className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-x-auto">
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(context, null, 2)}
              </pre>
            </div>
          )}
          
          {context && typeof context === 'string' && (
            <div className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-x-auto">
              <pre className="whitespace-pre-wrap break-words">{context}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 