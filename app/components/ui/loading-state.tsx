import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  isLoading: boolean;
  error?: string | null;
  children: React.ReactNode;
  loadingText?: string;
}

export function LoadingState({
  isLoading,
  error,
  children,
  loadingText = 'Loading...',
}: LoadingStateProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{loadingText}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 p-4 rounded-md border border-destructive">
        <p className="text-destructive font-medium">Error</p>
        <p className="text-destructive/80">{error}</p>
      </div>
    );
  }

  return <>{children}</>;
}
