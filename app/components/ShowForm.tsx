"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Show {
  id?: number;
  title: string;
  currentEpisode: number;
  totalEpisodes: number;
  status: string;
}

interface ShowFormProps {
  showId?: number;
  isEditing?: boolean;
}

export function ShowForm({ showId, isEditing = false }: ShowFormProps) {
  const [show, setShow] = useState<Show>({
    title: '',
    currentEpisode: 0,
    totalEpisodes: 0,
    status: 'ongoing',
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isEditing && showId) {
      fetchShow();
    }
  }, [isEditing, showId]);

  const fetchShow = async () => {
    setFetchLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/shows/${showId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch show');
      }
      const data = await response.json();
      setShow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching show:', err);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setShow(prev => ({
      ...prev,
      [name]: name === 'currentEpisode' || name === 'totalEpisodes' 
        ? parseInt(value) || 0 
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = isEditing ? `/api/shows/${showId}` : '/api/shows';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(show),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} show`);
      }

      const data = await response.json();
      router.push(isEditing ? `/shows/${data.id}` : '/');
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="currentEpisode" className="text-sm font-medium">
                  Current Episode
                </label>
                <input
                  id="currentEpisode"
                  name="currentEpisode"
                  type="number"
                  min="0"
                  value={show.currentEpisode}
                  onChange={handleChange}
                  className="w-full p-2 rounded-md border border-input bg-background"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="totalEpisodes" className="text-sm font-medium">
                  Total Episodes
                </label>
                <input
                  id="totalEpisodes"
                  name="totalEpisodes"
                  type="number"
                  min="0"
                  value={show.totalEpisodes}
                  onChange={handleChange}
                  className="w-full p-2 rounded-md border border-input bg-background"
                />
              </div>
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
          <CardFooter className="flex justify-end">
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