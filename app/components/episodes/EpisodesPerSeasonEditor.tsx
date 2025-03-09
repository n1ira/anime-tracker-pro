import React, { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Edit } from 'lucide-react';
import { EditorModal } from './EditorModal';

interface EpisodesPerSeasonEditorProps {
  showId: number;
  showTitle: string;
  initialEpisodesPerSeason: string;
  onUpdate: (episodesPerSeason: string) => void;
}

export function EpisodesPerSeasonEditor({
  showId,
  showTitle,
  initialEpisodesPerSeason,
  onUpdate,
}: EpisodesPerSeasonEditorProps) {
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
        const average =
          episodesArray.length > 0
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
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1"
        onClick={() => setIsModalOpen(true)}
      >
        <Edit className="h-3.5 w-3.5" />
        <span className="sr-only md:not-sr-only">Edit</span>
      </Button>
    );
  }

  return (
    <EditorModal
      showTitle={showTitle}
      isArray={isArray}
      episodesPerSeasonValue={episodesPerSeasonValue}
      onValueChange={setEpisodesPerSeasonValue}
      onToggleMode={toggleMode}
      onCancel={handleCancel}
      onSubmit={handleSubmit}
    />
  );
}

export default EpisodesPerSeasonEditor;
