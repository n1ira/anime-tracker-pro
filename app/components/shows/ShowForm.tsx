"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormFields } from './FormFields';
import { validateShowForm } from './ValidationLogic';
import { SubmitHandler } from './SubmitHandler';

interface Show {
  id?: number;
  title: string;
  alternateNames: string; // JSON string of alternate names
  episodesPerSeason: string; // Number or JSON array of numbers
  startSeason: number;
  startEpisode: number;
  endSeason: number;
  endEpisode: number;
  quality: string;
  status: string;
}

interface ShowFormProps {
  showId?: number;
  isEditing?: boolean;
}

export function ShowForm({ showId, isEditing = false }: ShowFormProps) {
  const [show, setShow] = useState<Show>({
    title: '',
    alternateNames: '[]',
    episodesPerSeason: '12',
    startSeason: 1,
    startEpisode: 1,
    endSeason: 1,
    endEpisode: 1,
    quality: '1080p',
    status: 'ongoing',
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const [newAlternateName, setNewAlternateName] = useState('');
  const [alternateNames, setAlternateNames] = useState<string[]>([]);
  const [isEpisodesPerSeasonArray, setIsEpisodesPerSeasonArray] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isEditing && showId) {
      fetchShow();
    }
  }, [isEditing, showId]);

  const fetchShow = async () => {
    try {
      setFetchLoading(true);
      const response = await fetch(`/api/shows/${showId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch show');
      }
      const data = await response.json();
      
      // Parse alternateNames from JSON string to array
      let parsedAlternateNames: string[] = [];
      try {
        parsedAlternateNames = JSON.parse(data.alternateNames || '[]');
      } catch (e) {
        console.error('Error parsing alternateNames:', e);
      }
      
      // Check if episodesPerSeason is an array
      let isArray = false;
      try {
        const parsed = JSON.parse(data.episodesPerSeason);
        isArray = Array.isArray(parsed);
        
        // If it's an array, convert it to comma-separated string for the form
        if (isArray) {
          data.episodesPerSeason = parsed.join(', ');
        }
      } catch (e) {
        // Not JSON, so it's a single number
        isArray = false;
      }
      
      setShow(data);
      setAlternateNames(parsedAlternateNames);
      setIsEpisodesPerSeasonArray(isArray);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle numeric fields
    if (['startSeason', 'startEpisode', 'endSeason', 'endEpisode'].includes(name)) {
      const numValue = parseInt(value, 10);
      setShow(prev => ({
        ...prev,
        [name]: isNaN(numValue) ? 0 : numValue
      }));
    } else {
      setShow(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const addAlternateName = () => {
    if (newAlternateName.trim()) {
      setAlternateNames(prev => [...prev, newAlternateName.trim()]);
      setNewAlternateName('');
    }
  };

  const removeAlternateName = (index: number) => {
    setAlternateNames(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepare the show data for submission
    const preparedShow = { ...show };
    
    // Convert alternateNames array to JSON string
    preparedShow.alternateNames = JSON.stringify(alternateNames);
    
    // Handle episodesPerSeason based on whether it's an array or single value
    if (isEpisodesPerSeasonArray) {
      try {
        const episodesArray = show.episodesPerSeason.split(',').map(num => parseInt(num.trim(), 10));
        preparedShow.episodesPerSeason = JSON.stringify(episodesArray);
      } catch (err) {
        setError('Invalid episodes per season format');
        return;
      }
    }
    
    // Validate the form
    const isValid = validateShowForm({
      show: preparedShow,
      isEpisodesPerSeasonArray,
      alternateNames,
      setError
    });
    
    if (!isValid) return;
    
    try {
      setLoading(true);
      
      const url = isEditing ? `/api/shows/${showId}` : '/api/shows';
      const method = isEditing ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preparedShow),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save show');
      }
      
      // Redirect to the shows list on success
      router.push('/');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit Show' : 'Add New Show'}</CardTitle>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent>
            {fetchLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <FormFields
                show={show}
                alternateNames={alternateNames}
                newAlternateName={newAlternateName}
                isEpisodesPerSeasonArray={isEpisodesPerSeasonArray}
                handleChange={handleChange}
                setNewAlternateName={setNewAlternateName}
                addAlternateName={addAlternateName}
                removeAlternateName={removeAlternateName}
                setIsEpisodesPerSeasonArray={setIsEpisodesPerSeasonArray}
              />
            )}
          </CardContent>
          
          <CardFooter>
            <SubmitHandler
              isEditing={isEditing}
              loading={loading}
              error={error}
            />
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 