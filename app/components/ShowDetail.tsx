"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ArrowLeft, Play, Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Episode {
  id: number;
  showId: number;
  episodeNumber: number;
  isDownloaded: boolean;
  magnetLink?: string;
}

interface Show {
  id: number;
  title: string;
  currentEpisode: number;
  totalEpisodes: number;
  status: string;
  lastScanned?: string;
}

interface ShowDetailProps {
  showId: number;
}

export function ShowDetail({ showId }: ShowDetailProps) {
  const [show, setShow] = useState<Show | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const router = useRouter();

  const fetchShow = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [showId]);

  const fetchEpisodes = useCallback(async () => {
    setEpisodesLoading(true);
    setEpisodesError(null);
    try {
      const response = await fetch(`/api/shows/${showId}/episodes`);
      if (!response.ok) {
        throw new Error('Failed to fetch episodes');
      }
      const data = await response.json();
      setEpisodes(data);
    } catch (err) {
      setEpisodesError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching episodes:', err);
    } finally {
      setEpisodesLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    fetchShow();
    fetchEpisodes();
  }, [fetchShow, fetchEpisodes]);

  const toggleEpisodeStatus = async (episode: Episode) => {
    try {
      const response = await fetch(`/api/shows/${showId}/episodes/${episode.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isDownloaded: !episode.isDownloaded,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update episode');
      }

      // Update the episodes list with the toggled status
      setEpisodes(episodes.map(ep => 
        ep.id === episode.id 
          ? { ...ep, isDownloaded: !ep.isDownloaded } 
          : ep
      ));
    } catch (err) {
      console.error('Error updating episode:', err);
      alert('Failed to update episode status');
    }
  };

  const startSingleShowScan = async () => {
    try {
      const response = await fetch(`/api/scan/show/${showId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start scan');
      }

      alert('Scan started successfully');
    } catch (err) {
      console.error('Error starting scan:', err);
      alert('Failed to start scan');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="text-destructive text-center py-8">
        {error || 'Show not found'}
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Shows
        </Button>
        <div className="space-x-2">
          <Button variant="outline" onClick={() => router.push(`/shows/${showId}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Show
          </Button>
          <Button onClick={startSingleShowScan}>
            <Play className="h-4 w-4 mr-2" />
            Scan This Show
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{show.title}</CardTitle>
              <CardDescription>
                Status: {show.status} | Episodes: {show.currentEpisode}/{show.totalEpisodes || '?'}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchShow();
                fetchEpisodes();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-medium mb-4">Episodes</h3>
          
          {episodesError && (
            <div className="text-destructive mb-4">{episodesError}</div>
          )}
          
          {episodesLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : episodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No episodes found for this show.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {episodes.map((episode) => (
                <div
                  key={episode.id}
                  className={`p-3 rounded-md border cursor-pointer transition-colors ${
                    episode.isDownloaded 
                      ? 'bg-success/10 hover:bg-success/20 border-success/30' 
                      : 'hover:bg-accent/50'
                  }`}
                  onClick={() => toggleEpisodeStatus(episode)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Episode {episode.episodeNumber}</span>
                    <Badge variant={episode.isDownloaded ? "success" : "outline"}>
                      {episode.isDownloaded ? 'Downloaded' : 'Needed'}
                    </Badge>
                  </div>
                  {episode.magnetLink && (
                    <div className="mt-2">
                      <a 
                        href={episode.magnetLink}
                        className="text-xs text-blue-500 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open Magnet Link
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 