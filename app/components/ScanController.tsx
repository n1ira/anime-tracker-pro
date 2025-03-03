"use client";

import React from 'react';
import { useScanState } from '../hooks/useScanState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    if (!scanState) return 'bg-secondary text-secondary-foreground';
    
    switch (scanState.status.toLowerCase()) {
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
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Scan Controller</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Status:</span>
            {scanState ? (
              <Badge className={getStatusColor()}>
                {scanState.status}
              </Badge>
            ) : (
              <Badge variant="outline">Unknown</Badge>
            )}
          </div>
          
          {scanState?.isScanning && scanState.currentShow && (
            <div className="flex justify-between items-center">
              <span className="font-medium">Current Show:</span>
              <span>{scanState.currentShow.title}</span>
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
      <CardFooter className="flex justify-between">
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