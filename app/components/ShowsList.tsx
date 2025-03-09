'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Loader2, Plus, RefreshCw, Trash2, Edit, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getSeasonAndEpisode } from '@/app/utils/episodeCalculator';
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
} from '@/app/components/ui/alert-dialog';

interface Show {
  id: number;
  title: string;
  status: string;
  lastScanned?: string;
  episodesPerSeason?: string;
  startSeason?: number;
  endSeason?: number;
}

interface Episode {
  showId: number;
  episodeNumber: number;
  isDownloaded: boolean;
  season?: number;
  episodeInSeason?: number;
}

interface EpisodesBySeason {
  [season: number]: {
    total: number;
    downloaded: number;
  };
}

export function ShowsList() {
  const [shows, setShows] = useState<Show[]>([]);
  const [episodes, setEpisodes] = useState<Record<number, Episode[]>>({});
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, EpisodesBySeason>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIdToDelete, setShowIdToDelete] = useState<number | null>(null);
  const router = useRouter();

  const fetchShows = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/shows');
      if (!response.ok) {
        throw new Error('Failed to fetch shows');
      }
      const data = await response.json();
      setShows(data);

      // Fetch episodes for each show
      const episodesData: Record<number, Episode[]> = {};
      for (const show of data) {
        try {
          const episodesResponse = await fetch(`/api/shows/${show.id}/episodes`);
          if (episodesResponse.ok) {
            const episodesJson = await episodesResponse.json();
            episodesData[show.id] = episodesJson;
          }
        } catch (err) {
          console.error(`Error fetching episodes for show ${show.id}:`, err);
        }
      }
      setEpisodes(episodesData);
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

  // Process episodes to group by season
  useEffect(() => {
    const showEpisodesBySeason: Record<number, EpisodesBySeason> = {};

    shows.forEach(show => {
      const showEpisodes = episodes[show.id] || [];
      if (showEpisodes.length === 0) return;

      // Parse episodesPerSeason
      let episodesPerSeason: number | number[] = 12;
      if (show.episodesPerSeason) {
        try {
          const parsed = JSON.parse(show.episodesPerSeason);
          if (Array.isArray(parsed)) {
            episodesPerSeason = parsed;
          } else {
            episodesPerSeason = parseInt(show.episodesPerSeason, 10) || 12;
          }
        } catch (e) {
          // Not JSON, treat as a number
          episodesPerSeason = parseInt(show.episodesPerSeason, 10) || 12;
        }
      }

      // Group episodes by season
      const seasonData: EpisodesBySeason = {};

      showEpisodes.forEach(episode => {
        const { season } = getSeasonAndEpisode(episode.episodeNumber, show.title, {
          [show.title]: { episodes_per_season: episodesPerSeason },
        });

        if (!seasonData[season]) {
          seasonData[season] = { total: 0, downloaded: 0 };
        }

        seasonData[season].total += 1;
        if (episode.isDownloaded) {
          seasonData[season].downloaded += 1;
        }
      });

      showEpisodesBySeason[show.id] = seasonData;
    });

    setEpisodesBySeason(showEpisodesBySeason);
  }, [shows, episodes]);

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

  const handleDeleteShow = async () => {
    if (!showIdToDelete) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/shows/${showIdToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete show');
      }

      // Remove the show from the local state
      setShows(shows.filter(show => show.id !== showIdToDelete));
      setShowIdToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error deleting show:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowClick = (showId: number, e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    if ((e.target as HTMLElement).closest('.show-actions')) {
      return;
    }
    router.push(`/shows/${showId}`);
  };

  // Helper function to calculate current episode number
  const getCurrentEpisode = (showId: number) => {
    const showEpisodes = episodes[showId] || [];
    return showEpisodes.filter(ep => ep.isDownloaded).length;
  };

  // Helper function to calculate total episodes number
  const getTotalEpisodes = (showId: number) => {
    const showEpisodes = episodes[showId] || [];
    return showEpisodes.length;
  };

  // Determine if a show has multiple seasons
  const hasMultipleSeasons = (showId: number): boolean => {
    const seasons = episodesBySeason[showId] || {};
    return Object.keys(seasons).length > 1;
  };

  // Render the episodes count display (either single total or per-season breakdown)
  const renderEpisodesCount = (showId: number) => {
    const seasonData = episodesBySeason[showId];

    // If we don't have season data yet, show the simple count
    if (!seasonData || Object.keys(seasonData).length === 0) {
      return (
        <span className="text-sm text-muted-foreground">
          Episodes: {getCurrentEpisode(showId)}/{getTotalEpisodes(showId) || '?'}
        </span>
      );
    }

    // If it's just one season, show the simple count
    if (Object.keys(seasonData).length === 1) {
      return (
        <span className="text-sm text-muted-foreground">
          Episodes: {getCurrentEpisode(showId)}/{getTotalEpisodes(showId) || '?'}
        </span>
      );
    }

    // For multiple seasons, show the breakdown
    return (
      <div className="text-sm text-muted-foreground">
        <span>
          Total: {getCurrentEpisode(showId)}/{getTotalEpisodes(showId)}
        </span>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(seasonData).map(([season, data]) => (
            <Badge key={`${showId}-s${season}`} variant="outline" className="text-xs">
              S{season}: {data.downloaded}/{data.total}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex justify-between items-center">
            <CardTitle>My Shows</CardTitle>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={fetchShows} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
              <Button variant="default" size="sm" onClick={() => router.push('/shows/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Show
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {error && <div className="text-destructive mb-4">{error}</div>}
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : shows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No shows found. Add a show to get started.
            </div>
          ) : (
            <div className="grid gap-3">
              {shows.map(show => (
                <div
                  key={show.id}
                  className={`flex items-center justify-between p-4 rounded-md border hover:bg-accent/50 cursor-pointer transition-colors shadow-sm ${
                    hasMultipleSeasons(show.id) ? 'flex-col items-start' : ''
                  }`}
                  onClick={e => handleShowClick(show.id, e)}
                >
                  <div
                    className={`flex ${hasMultipleSeasons(show.id) ? 'flex-col w-full' : 'items-center justify-between w-full'}`}
                  >
                    <div
                      className={`flex ${hasMultipleSeasons(show.id) ? 'flex-col' : 'flex-col flex-grow'}`}
                    >
                      <span className="font-medium text-lg">{show.title}</span>
                      {renderEpisodesCount(show.id)}
                    </div>

                    <div
                      className={`flex items-center ${hasMultipleSeasons(show.id) ? 'mt-2 w-full justify-between' : 'space-x-2'}`}
                    >
                      {getStatusBadge(show.status)}
                      {show.lastScanned && (
                        <span className="text-xs text-muted-foreground">
                          Last scanned: {new Date(show.lastScanned).toLocaleString()}
                        </span>
                      )}
                      <div className="show-actions flex space-x-1 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-accent"
                          onClick={e => {
                            e.stopPropagation();
                            router.push(`/shows/${show.id}`);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-accent"
                          onClick={e => {
                            e.stopPropagation();
                            router.push(`/shows/${show.id}/edit`);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={e => {
                            e.stopPropagation();
                            setShowIdToDelete(show.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!showIdToDelete}
        onOpenChange={open => {
          if (!open) setShowIdToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the show &quot;
              {shows.find(show => show.id === showIdToDelete)?.title}&quot; and all its episodes.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteShow}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
