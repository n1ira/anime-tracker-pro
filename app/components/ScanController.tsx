"use client";

import React from 'react';
import { useScanState } from '../hooks/useScanState';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Loader2, Play, StopCircle, RefreshCw } from 'lucide-react';

export function ScanController() {
  const { scanState, loading, error, startScan, stopScan, refreshScanState } = useScanState();

  const handleStartAllScan = () => {
    startScan();
  };

  const handleStopScan = () => {
    stopScan();
  };

  const getStatusColor = () => {
    if (!scanState || !scanState.status) return 'bg-secondary text-secondary-foreground';
    
    try {
      const statusLower = scanState.status.toLowerCase();
      
      switch (statusLower) {
        case 'idle':
          return 'bg-secondary text-secondary-foreground';
        case 'error':
          return 'bg-destructive text-destructive-foreground';
        case 'stopped':
          return 'bg-warning text-warning-foreground';
        default:
          return scanState.isScanning 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-secondary text-secondary-foreground';
      }
    } catch (err) {
      // If there's any error processing the status, return a default
      console.error('Error processing scan status:', err);
      return 'bg-secondary text-secondary-foreground';
    }
  };

  // Determine the display status, defaulting to 'Idle' instead of 'Unknown'
  const getDisplayStatus = () => {
    if (!scanState) return 'Idle';
    if (!scanState.status) return scanState.isScanning ? 'Scanning' : 'Idle';
    return scanState.status;
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle>Scan Controller</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Status:</span>
            {scanState ? (
              <Badge className={getStatusColor()}>
                {getDisplayStatus()}
              </Badge>
            ) : (
              <Badge variant="outline">Idle</Badge>
            )}
          </div>
          
          {scanState?.isScanning && scanState.currentShowId && (
            <div className="flex justify-between items-center">
              <span className="font-medium">Current Show:</span>
              {scanState.currentShow ? (
                <span>{scanState.currentShow.title}</span>
              ) : (
                <span>ID: {scanState.currentShowId}</span>
              )}
            </div>
          )}
          
          {scanState?.isScanning && scanState.startedAt && (
            <div className="flex justify-between items-center">
              <span className="font-medium">Started At:</span>
              <span>{new Date(scanState.startedAt).toLocaleTimeString()}</span>
            </div>
          )}
          
          {error && (
            <div className="text-destructive text-sm mt-2">{error}</div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t bg-muted/10 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshScanState}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
        
        <div className="space-x-2">
          {scanState?.isScanning ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStopScan}
              disabled={loading}
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Stop Scan
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleStartAllScan}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Scan All Shows
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
} 