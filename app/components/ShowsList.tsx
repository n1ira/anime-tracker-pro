"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Show {
  id: number;
  title: string;
  currentEpisode: number;
  totalEpisodes: number;
  status: string;
  lastScanned?: string;
}

export function ShowsList() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchShows = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/shows');
      if (!response.ok) {
        throw new Error('Failed to fetch shows');
      }
      const data = await response.json();
      setShows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching shows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShows();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <Badge className="bg-success text-success-foreground">Completed</Badge>;
      case 'ongoing':
        return <Badge className="bg-primary text-primary-foreground">Ongoing</Badge>;
      case 'paused':
        return <Badge className="bg-warning text-warning-foreground">Paused</Badge>;
      default:
        return <Badge className="bg-secondary text-secondary-foreground">{status}</Badge>;
    }
  };

  const handleShowClick = (showId: number) => {
    router.push(`/shows/${showId}`);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Tracked Shows</CardTitle>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchShows}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push('/shows/new')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Show
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-destructive mb-4">{error}</div>
        )}
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : shows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No shows found. Add a show to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {shows.map((show) => (
              <div
                key={show.id}
                className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => handleShowClick(show.id)}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{show.title}</span>
                  <span className="text-sm text-muted-foreground">
                    Episodes: {show.currentEpisode}/{show.totalEpisodes || '?'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(show.status)}
                  {show.lastScanned && (
                    <span className="text-xs text-muted-foreground">
                      Last scanned: {new Date(show.lastScanned).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 