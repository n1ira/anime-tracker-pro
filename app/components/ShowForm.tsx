'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Loader2, Save, ArrowLeft, Plus, X, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';

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

  const fetchShow = async () => {
    setFetchLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/shows/${showId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch show: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const showData = data;
      
      setShow({
        id: showData.id,
        title: showData.title || '',
        alternateNames: showData.alternateNames || '[]',
        episodesPerSeason: showData.episodesPerSeason || '',
        startSeason: showData.startSeason || 1,
        startEpisode: showData.startEpisode || 1,
        endSeason: showData.endSeason || 1,
        endEpisode: showData.endEpisode || 0,
        quality: showData.quality || '1080p',
        status: showData.status || 'ongoing',
      });

      try {
        const eps = JSON.parse(showData.episodesPerSeason);
        if (Array.isArray(eps)) {
          setIsEpisodesPerSeasonArray(true);
        }
      } catch (e) {
        setIsEpisodesPerSeasonArray(false);
      }
    } catch (error) {
      console.error('Error fetching show:', error);
      setError(error instanceof Error ? error.message : 'Failed to load show data');
      toast.error('Failed to load show data');
    } finally {
      setFetchLoading(false);
    }
  };

  const memoizedFetchShow = useCallback(fetchShow, [showId]);

  useEffect(() => {
    if (isEditing && showId) {
      memoizedFetchShow();
    }
  }, [isEditing, showId, memoizedFetchShow]);

  useEffect(() => {
    try {
      const names = JSON.parse(show.alternateNames);
      setAlternateNames(Array.isArray(names) ? names : []);
    } catch (e) {
      setAlternateNames([]);
    }
  }, [show.alternateNames]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'episodesPerSeason') {
      if (isEpisodesPerSeasonArray) {
        setShow(prev => ({ ...prev, [name]: value }));
      } else {
        const numValue = parseInt(value) || 12;
        setShow(prev => ({ ...prev, [name]: numValue.toString() }));
      }
    } else {
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
        alternateNames: JSON.stringify(updatedNames),
      }));
      setNewAlternateName('');
    }
  };

  const removeAlternateName = (index: number) => {
    const updatedNames = alternateNames.filter((_, i) => i !== index);
    setAlternateNames(updatedNames);
    setShow(prev => ({
      ...prev,
      alternateNames: JSON.stringify(updatedNames),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formattedShow = { ...show };

      if (isEpisodesPerSeasonArray) {
        const episodesArray = show.episodesPerSeason
          .split(',')
          .map(val => parseInt(val.trim()))
          .filter(val => !isNaN(val));

        if (episodesArray.length > 0) {
          formattedShow.episodesPerSeason = JSON.stringify(episodesArray);
        } else {
          formattedShow.episodesPerSeason = '12';
        }
      }

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
        <span className="ml-2">Loading show data...</span>
      </div>
    );
  }

  if (error && isEditing) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        
        <Card className="shadow-md border-t-4 border-t-destructive">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-destructive">Error Loading Show</CardTitle>
            <p className="text-sm text-muted-foreground">
              There was a problem loading the show data. Please try again later.
            </p>
          </CardHeader>
          <CardContent>
            <div className="bg-destructive/10 text-destructive rounded-md px-4 py-3 text-sm font-medium border border-destructive/20">
              {error}
            </div>
          </CardContent>
          <CardFooter className="pt-4 pb-4 flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => {
                setError(null);
                memoizedFetchShow();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="hover:bg-primary/10"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Card className="shadow-md border-t-4 border-t-primary">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 text-transparent bg-clip-text">
            {isEditing ? 'Edit Show' : 'Add New Show'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isEditing
              ? 'Update the details for your anime show'
              : 'Fill in the details to add a new anime to your collection'}
          </p>
        </CardHeader>
        <div className="border-t border-border" />
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-6">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md px-4 py-3 text-sm font-medium border border-destructive/20">
                {error}
              </div>
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
                placeholder="Enter show title"
                className="w-full p-2 rounded-md border border-input bg-background shadow-sm"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Alternate Names</label>
              <div className="flex flex-wrap gap-2 mb-2 min-h-8">
                {alternateNames.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No alternate names added</p>
                )}
                {alternateNames.map((name, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1 px-2 py-1 rounded-md"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => removeAlternateName(index)}
                      className="text-muted-foreground/70 hover:text-destructive transition-colors"
                      aria-label={`Remove ${name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex">
                <input
                  type="text"
                  value={newAlternateName}
                  onChange={e => setNewAlternateName(e.target.value)}
                  className="flex-1 p-2 rounded-l-md border border-input bg-background shadow-sm"
                  placeholder="Add alternate name"
                />
                <Button
                  type="button"
                  onClick={addAlternateName}
                  className="rounded-l-none"
                  disabled={!newAlternateName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Episodes Per Season</label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <input
                      type="radio"
                      id="singleValue"
                      checked={!isEpisodesPerSeasonArray}
                      onChange={() => setIsEpisodesPerSeasonArray(false)}
                      className="mr-1"
                    />
                    <label htmlFor="singleValue" className="text-xs cursor-pointer">
                      Single value
                    </label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <input
                      type="radio"
                      id="perSeason"
                      checked={isEpisodesPerSeasonArray}
                      onChange={() => setIsEpisodesPerSeasonArray(true)}
                      className="mr-1"
                    />
                    <label htmlFor="perSeason" className="text-xs cursor-pointer">
                      Per season
                    </label>
                  </div>
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
                  className="w-full p-2 rounded-md border border-input bg-background shadow-sm"
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
                    className="w-full p-2 rounded-md border border-input bg-background shadow-sm"
                    placeholder="e.g. 12,13,24"
                  />
                  <div className="text-sm text-muted-foreground mt-1">
                    Enter the number of episodes per season. For example, if the show has 12
                    episodes in season 1 and 24 in season 2, enter &quot;12,24&quot;. Leave empty
                    for automatic calculation.
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-1">
              <label className="text-sm font-medium">Episode Range</label>
              <div className="grid sm:grid-cols-4 grid-cols-2 gap-4">
                <div className="space-y-1">
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
                    className="w-full p-2 rounded-md border border-input bg-background shadow-sm"
                  />
                </div>
                <div className="space-y-1">
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
                    className="w-full p-2 rounded-md border border-input bg-background shadow-sm"
                  />
                </div>
                <div className="space-y-1">
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
                    className="w-full p-2 rounded-md border border-input bg-background shadow-sm"
                  />
                </div>
                <div className="space-y-1">
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
                    className="w-full p-2 rounded-md border border-input bg-background shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 pt-1">
              <div className="space-y-2">
                <label htmlFor="quality" className="text-sm font-medium">
                  Quality
                </label>
                <select
                  id="quality"
                  name="quality"
                  value={show.quality}
                  onChange={handleChange}
                  className="w-full p-2 rounded-md border border-input bg-background shadow-sm"
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
                  className="w-full p-2 rounded-md border border-input bg-background shadow-sm"
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>
          </CardContent>
          <div className="border-t border-border my-1" />
          <CardFooter className="pt-4 pb-4 flex justify-end">
            <Button type="submit" disabled={loading} className="relative overflow-hidden group">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
              )}
              <span>{isEditing ? 'Update Show' : 'Add Show'}</span>
              <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
