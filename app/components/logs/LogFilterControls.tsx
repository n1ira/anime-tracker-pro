import React from 'react';
import { Button } from '@/app/components/ui/button';
import { Trash2, RefreshCw } from 'lucide-react';
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

interface LogFilterControlsProps {
  onClearLogs: () => void;
  onRefreshLogs: () => void;
  clearLoading: boolean;
  clearError: string | null;
  setClearDialogOpen: (open: boolean) => void;
}

export function LogFilterControls({
  onClearLogs,
  onRefreshLogs,
  clearLoading,
  clearError,
  setClearDialogOpen
}: LogFilterControlsProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex space-x-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefreshLogs}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <AlertDialog onOpenChange={setClearDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button 
            variant="destructive" 
            size="sm"
            disabled={clearLoading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Logs
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all logs?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All logs will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {clearError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {clearError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onClearLogs}>
              {clearLoading ? 'Clearing...' : 'Clear Logs'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 