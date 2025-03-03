import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Save, X } from 'lucide-react';

interface EpisodesPerSeasonEditorProps {
  showId: number;
  showTitle: string;
  initialEpisodesPerSeason: string;
  onUpdate: (episodesPerSeason: string) => void;
}

const EpisodesPerSeasonEditor: React.FC<EpisodesPerSeasonEditorProps> = ({
  showId,
  showTitle,
  initialEpisodesPerSeason,
  onUpdate
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [episodesPerSeasonValue, setEpisodesPerSeasonValue] = useState('');
  const [isArray, setIsArray] = useState(false);
  const [episodesArray, setEpisodesArray] = useState<number[]>([]);

  useEffect(() => {
    // Initialize the form values when the modal opens
    if (isModalOpen) {
      try {
        const parsed = JSON.parse(initialEpisodesPerSeason);
        if (Array.isArray(parsed)) {
          setIsArray(true);
          setEpisodesArray(parsed);
          setEpisodesPerSeasonValue(parsed.join(', '));
        } else {
          setIsArray(false);
          setEpisodesPerSeasonValue(initialEpisodesPerSeason);
        }
      } catch (e) {
        // If not JSON, assume it's a simple number
        setIsArray(false);
        setEpisodesPerSeasonValue(initialEpisodesPerSeason);
      }
    }
  }, [isModalOpen, initialEpisodesPerSeason]);

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    try {
      let episodesPerSeason;
      
      if (isArray) {
        // Parse comma-separated values into an array of numbers
        episodesPerSeason = episodesPerSeasonValue
          .split(',')
          .map(str => Number(str.trim()))
          .filter(num => !isNaN(num));
      } else {
        // Use as a single number
        const num = Number(episodesPerSeasonValue);
        episodesPerSeason = isNaN(num) ? 12 : num;
      }

      const response = await fetch(`/api/shows/${showId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ episodesPerSeason }),
      });

      if (!response.ok) {
        throw new Error('Failed to update episodes per season');
      }

      // Format the value for display
      const formattedValue = isArray 
        ? JSON.stringify(episodesPerSeason) 
        : episodesPerSeason.toString();
      
      onUpdate(formattedValue);
      alert(`Episodes per season updated for ${showTitle}`);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error updating episodes per season:', error);
      alert('Failed to update episodes per season');
    }
  };

  const toggleMode = () => {
    setIsArray(!isArray);
    if (!isArray) {
      // Converting from single number to array
      const num = Number(episodesPerSeasonValue);
      if (!isNaN(num)) {
        setEpisodesArray([num]);
        setEpisodesPerSeasonValue(num.toString());
      } else {
        setEpisodesArray([12]);
        setEpisodesPerSeasonValue('12');
      }
    } else {
      // Converting from array to single number
      try {
        const average = episodesArray.length > 0 
          ? Math.round(episodesArray.reduce((a, b) => a + b, 0) / episodesArray.length)
          : 12;
        setEpisodesPerSeasonValue(average.toString());
      } catch (e) {
        setEpisodesPerSeasonValue('12');
      }
    }
  };

  // Simple modal implementation with CSS
  if (!isModalOpen) {
    return (
      <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setIsModalOpen(true)}>
        <Edit className="h-3.5 w-3.5" />
        <span className="sr-only md:not-sr-only">Edit</span>
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Episodes Per Season - {showTitle}</h2>
          <button 
            onClick={handleCancel}
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
            onChange={(e) => setEpisodesPerSeasonValue(e.target.value)}
            placeholder={isArray ? "12, 13, 24" : "12"}
            className="w-full p-2 border rounded-md"
          />
        </div>
        
        {isArray && (
          <div className="mb-4">
            <h4 className="font-medium mb-2">Season Breakdown:</h4>
            <div className="space-y-1">
              {episodesPerSeasonValue
                .split(',')
                .map((value, index) => {
                  const num = Number(value.trim());
                  return !isNaN(num) ? (
                    <div key={index} className="text-sm">
                      Season {index + 1}: {num} episodes
                    </div>
                  ) : null;
                })
                .filter(Boolean)}
            </div>
          </div>
        )}
        
        <div className="flex justify-between">
          <button
            onClick={toggleMode}
            className="px-4 py-2 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isArray ? 'Use Single Value' : 'Use Array (Multiple Seasons)'}
          </button>
          
          <div className="space-x-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpisodesPerSeasonEditor; 