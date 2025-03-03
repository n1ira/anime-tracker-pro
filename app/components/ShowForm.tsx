"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save, ArrowLeft, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

  useEffect(() => {
    // Parse alternateNames from JSON string when show changes
    try {
      const names = JSON.parse(show.alternateNames);
      setAlternateNames(Array.isArray(names) ? names : []);
    } catch (e) {
      setAlternateNames([]);
    }
  }, [show.alternateNames]);

  const fetchShow = async () => {
    setFetchLoading(true);
    try {
      const response = await fetch(`/api/shows/${showId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch show');
      }
      
      const data = await response.json();
      
      // Handle episodesPerSeason format
      if (data.episodesPerSeason) {
        try {
          const parsedEpisodes = JSON.parse(data.episodesPerSeason);
          // If it's an array, set the array mode
          if (Array.isArray(parsedEpisodes)) {
            setIsEpisodesPerSeasonArray(true);
            data.episodesPerSeason = parsedEpisodes.join(',');
          } else {
            setIsEpisodesPerSeasonArray(false);
          }
        } catch (e) {
          // Not JSON, assume it's a single number as string
          setIsEpisodesPerSeasonArray(false);
        }
      }
      
      // Parse alternate names
      if (data.alternateNames) {
        try {
          const parsed = JSON.parse(data.alternateNames);
          setAlternateNames(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          setAlternateNames([]);
        }
      }
      
      setShow(data);
    } catch (error) {
      console.error('Error fetching show:', error);
      setError('Failed to fetch show. Please try again.');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle episodesPerSeason field specially
    if (name === 'episodesPerSeason') {
      if (isEpisodesPerSeasonArray) {
        // For array type, just store the raw string (will be processed on submit)
        setShow(prev => ({ ...prev, [name]: value }));
      } else {
        // For single value type, store as a number string
        const numValue = parseInt(value) || 12;
        setShow(prev => ({ ...prev, [name]: numValue.toString() }));
      }
    } else {
      // Handle other fields normally
      setShow(prev => ({
        ...prev,
        [name]: ['startSeason', 'startEpisode', 'endSeason', 'endEpisode'].includes(name)
          ? parseInt(value) || 0 
          : value,
      }));
    }
  };

  const addAlternateName = () => {
    if (newAlternateName.trim() && !alternateNames.includes(newAlternateName.trim())) {
      const updatedNames = [...alternateNames, newAlternateName.trim()];
      setAlternateNames(updatedNames);
      setShow(prev => ({
        ...prev,
        alternateNames: JSON.stringify(updatedNames)
      }));
      setNewAlternateName('');
    }
  };

  const removeAlternateName = (index: number) => {
    const updatedNames = alternateNames.filter((_, i) => i !== index);
    setAlternateNames(updatedNames);
    setShow(prev => ({
      ...prev,
      alternateNames: JSON.stringify(updatedNames)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Format episodesPerSeason based on input type
      let formattedShow = { ...show };
      
      if (isEpisodesPerSeasonArray) {
        // Parse comma-separated values into an array
        const episodesArray = show.episodesPerSeason
          .split(',')
          .map(val => parseInt(val.trim()))
          .filter(val => !isNaN(val));
          
        if (episodesArray.length > 0) {
          // Store as JSON string
          formattedShow.episodesPerSeason = JSON.stringify(episodesArray);
        } else {
          // Default to 12 if parsing fails
          formattedShow.episodesPerSeason = '12';
        }
      }
      // If it's a single value, it's already in the correct format as a string

      const url = isEditing ? `/api/shows/${showId}` : '/api/shows';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedShow),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} show`);
      }

      const data = await response.json();
      
      // For editing, use the existing showId for redirection
      // For creating, use the ID from the response
      if (isEditing && showId) {
        router.push(`/shows/${showId}`);
      } else {
        router.push(data.id ? `/shows/${data.id}` : '/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error(`Error ${isEditing ? 'updating' : 'creating'} show:`, err);
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit Show' : 'Add New Show'}</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="text-destructive mb-4">{error}</div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                value={show.title}
                onChange={handleChange}
                required
                className="w-full p-2 rounded-md border border-input bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Alternate Names
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {alternateNames.map((name, index) => (
                  <div key={index} className="flex items-center bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                    <span className="mr-1">{name}</span>
                    <button 
                      type="button" 
                      onClick={() => removeAlternateName(index)}
                      className="text-secondary-foreground/70 hover:text-secondary-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex">
                <input
                  type="text"
                  value={newAlternateName}
                  onChange={(e) => setNewAlternateName(e.target.value)}
                  className="flex-1 p-2 rounded-l-md border border-input bg-background"
                  placeholder="Add alternate name"
                />
                <Button 
                  type="button" 
                  onClick={addAlternateName}
                  className="rounded-l-none"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Episodes Per Season</label>
                <div className="flex items-center space-x-2">
                  <label className="text-xs">
                    <input
                      type="radio"
                      checked={!isEpisodesPerSeasonArray}
                      onChange={() => setIsEpisodesPerSeasonArray(false)}
                      className="mr-1"
                    />
                    Single value
                  </label>
                  <label className="text-xs">
                    <input
                      type="radio"
                      checked={isEpisodesPerSeasonArray}
                      onChange={() => setIsEpisodesPerSeasonArray(true)}
                      className="mr-1"
                    />
                    Per season
                  </label>
                </div>
              </div>
              
              {!isEpisodesPerSeasonArray ? (
                <input
                  id="episodesPerSeason"
                  name="episodesPerSeason"
                  type="number"
                  min="1"
                  value={show.episodesPerSeason}
                  onChange={handleChange}
                  className="w-full p-2 rounded-md border border-input bg-background"
                  placeholder="Default: 12"
                />
              ) : (
                <div className="space-y-2">
                  <input
                    id="episodesPerSeason"
                    name="episodesPerSeason"
                    type="text"
                    value={show.episodesPerSeason}
                    onChange={handleChange}
                    className="w-full p-2 rounded-md border border-input bg-background"
                    placeholder="e.g. 12,13,24"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter comma-separated values, one for each season (e.g., &ldquo;12,13,24&rdquo;)
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Episode Range
              </label>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label htmlFor="startSeason" className="text-xs text-muted-foreground">
                    Start Season
                  </label>
                  <input
                    id="startSeason"
                    name="startSeason"
                    type="number"
                    min="1"
                    value={show.startSeason}
                    onChange={handleChange}
                    className="w-full p-2 rounded-md border border-input bg-background"
                  />
                </div>
                <div>
                  <label htmlFor="startEpisode" className="text-xs text-muted-foreground">
                    Start Episode
                  </label>
                  <input
                    id="startEpisode"
                    name="startEpisode"
                    type="number"
                    min="1"
                    value={show.startEpisode}
                    onChange={handleChange}
                    className="w-full p-2 rounded-md border border-input bg-background"
                  />
                </div>
                <div>
                  <label htmlFor="endSeason" className="text-xs text-muted-foreground">
                    End Season
                  </label>
                  <input
                    id="endSeason"
                    name="endSeason"
                    type="number"
                    min="1"
                    value={show.endSeason}
                    onChange={handleChange}
                    className="w-full p-2 rounded-md border border-input bg-background"
                  />
                </div>
                <div>
                  <label htmlFor="endEpisode" className="text-xs text-muted-foreground">
                    End Episode
                  </label>
                  <input
                    id="endEpisode"
                    name="endEpisode"
                    type="number"
                    min="1"
                    value={show.endEpisode}
                    onChange={handleChange}
                    className="w-full p-2 rounded-md border border-input bg-background"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="quality" className="text-sm font-medium">
                Quality
              </label>
              <select
                id="quality"
                name="quality"
                value={show.quality}
                onChange={handleChange}
                className="w-full p-2 rounded-md border border-input bg-background"
              >
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={show.status}
                onChange={handleChange}
                className="w-full p-2 rounded-md border border-input bg-background"
              >
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isEditing ? 'Update Show' : 'Add Show'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 