import React from 'react';
import { Button } from '@/app/components/ui/button';
import { X } from 'lucide-react';
import { SeasonBreakdown } from './SeasonBreakdown';

interface EditorModalProps {
  showTitle: string;
  isArray: boolean;
  episodesPerSeasonValue: string;
  onValueChange: (value: string) => void;
  onToggleMode: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function EditorModal({
  showTitle,
  isArray,
  episodesPerSeasonValue,
  onValueChange,
  onToggleMode,
  onCancel,
  onSubmit
}: EditorModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Episodes Per Season - {showTitle}</h2>
          <button 
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">
            {isArray 
              ? "Enter the number of episodes for each season, separated by commas. The first number is for Season 1, etc."
              : "Enter a single number to use for all seasons"}
          </p>
          
          <label className="block text-sm font-medium mb-1">
            {isArray 
              ? "Episodes per season (comma-separated list, e.g. '12, 13, 24')"
              : "Episodes per season (default: 12)"}
          </label>
          
          <input
            type="text"
            value={episodesPerSeasonValue}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={isArray ? "12, 13, 24" : "12"}
            className="w-full p-2 border rounded-md"
          />
        </div>
        
        {isArray && (
          <SeasonBreakdown episodesPerSeasonValue={episodesPerSeasonValue} />
        )}
        
        <div className="flex justify-between">
          <button
            onClick={onToggleMode}
            className="px-4 py-2 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isArray ? 'Use Single Value' : 'Use Array (Multiple Seasons)'}
          </button>
          
          <div className="space-x-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 