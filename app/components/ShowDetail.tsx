"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ArrowLeft, Play, Edit, ChevronDown, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getSeasonAndEpisode } from '@/app/utils/episodeCalculator';

// Dynamically import the EpisodesPerSeasonEditor component
const EpisodesPerSeasonEditor = dynamic(() => import('./EpisodesPerSeasonEditor'), {
  ssr: false,
  loading: () => <span>Loading...</span>
});

interface Episode {
  id: number;
  showId: number;
  episodeNumber: number;
  isDownloaded: boolean;
  magnetLink?: string;
  season?: number;
  episodeInSeason?: number;
}

interface Show {
  id: number;
  title: string;
  status: string;
  lastScanned?: string;
  episodesPerSeason?: string;
  startSeason?: number;
  endSeason?: number;
  startEpisode?: number;
  endEpisode?: number;
}

interface ShowDetailProps {
  showId: number;
}

export function ShowDetail({ showId }: ShowDetailProps) {
  const [show, setShow] = useState<Show | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, Episode[]>>({});
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
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

  // Group episodes by season when they're loaded or show data changes
  useEffect(() => {
    if (episodes.length > 0 && show) {
      console.log(`Grouping ${episodes.length} episodes for show "${show.title}" (range: S${show.startSeason || 1}E${show.startEpisode || 1} to S${show.endSeason || 1}E${show.endEpisode || 1})`);
      
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

      // Calculate season for each episode
      const groupedEpisodes: Record<number, Episode[]> = {};
      const newExpandedState: Record<number, boolean> = {};
      
      // Preprocess episodes to add season information
      const updatedEpisodes = episodes.map(episode => {
        const { season, episode: episodeInSeason } = getSeasonAndEpisode(
          episode.episodeNumber,
          show.title,
          { [show.title]: { episodes_per_season: episodesPerSeason } }
        );
        
        console.log(`Episode #${episode.episodeNumber} maps to S${season}E${episodeInSeason}`);
        
        return {
          ...episode,
          season,
          episodeInSeason
        };
      });
      
      // Group episodes by season
      updatedEpisodes.forEach(episode => {
        const season = episode.season || 1;
        if (!groupedEpisodes[season]) {
          groupedEpisodes[season] = [];
          // Default to expanded for single season, collapsed for multiple
          newExpandedState[season] = Object.keys(groupedEpisodes).length <= 1;
        }
        groupedEpisodes[season].push(episode);
      });
      
      // Clear any empty season groups if there are no episodes for them
      Object.keys(groupedEpisodes).forEach(season => {
        if (groupedEpisodes[Number(season)].length === 0) {
          delete groupedEpisodes[Number(season)];
          delete newExpandedState[Number(season)];
        }
      });
      
      console.log(`Grouped episodes into ${Object.keys(groupedEpisodes).length} seasons`);
      Object.entries(groupedEpisodes).forEach(([season, eps]) => {
        console.log(`Season ${season}: ${eps.length} episodes`);
      });
      
      setEpisodesBySeason(groupedEpisodes);
      // Only initialize expanded state if it hasn't been set before
      if (Object.keys(expandedSeasons).length === 0) {
        setExpandedSeasons(newExpandedState);
      }
    }
  }, [episodes, show, expandedSeasons]);

  // Calculate current episode and total episodes
  useEffect(() => {
    if (episodes.length > 0) {
      // Total episodes is simply the count of episodes
      setTotalEpisodes(episodes.length);
      
      // Current episode is the number of downloaded episodes
      const downloadedCount = episodes.filter(ep => ep.isDownloaded).length;
      setCurrentEpisode(downloadedCount);
    }
  }, [episodes]);

  const toggleSeasonCollapse = (season: number) => {
    setExpandedSeasons(prev => ({
      ...prev,
      [season]: !prev[season]
    }));
  };

  const toggleEpisodeStatus = async (episode: Episode) => {
    try {
      console.log('Toggling episode status:', episode);
      
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
        const errorData = await response.json().catch(() => ({}));
        console.error('Server error response:', errorData);
        throw new Error(`Failed to update episode: ${response.status} ${response.statusText}`);
      }

      const updatedEpisode = await response.json();
      console.log('Updated episode from server:', updatedEpisode);

      // Update the episodes list with the toggled status
      setEpisodes(episodes.map(ep => 
        ep.id === episode.id 
          ? { ...ep, isDownloaded: !ep.isDownloaded } 
          : ep
      ));
      
      console.log('Episodes state updated');
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

  const handleEpisodesPerSeasonUpdate = (newValue: string) => {
    if (show) {
      setShow({
        ...show,
        episodesPerSeason: newValue
      });
      // Refresh show data to reflect the changes
      fetchShow();
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
        </div>
      </div>

      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 text-transparent bg-clip-text">{show.title}</CardTitle>
              <CardDescription>
                Status: {show.status} | Episodes: {currentEpisode}/{totalEpisodes || '?'} 
                {(show.startSeason && show.endSeason) ? (
                  <span className="ml-1 text-xs">
                    (Range: S{show.startSeason}E{show.startEpisode} - S{show.endSeason}E{show.endEpisode})
                  </span>
                ) : null}
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
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Last Scanned:</span>
                <span className="text-muted-foreground">
                  {show.lastScanned ? new Date(show.lastScanned).toLocaleString() : 'Never'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="font-semibold">Episodes per Season:</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {show.episodesPerSeason
                      ? (() => {
                          try {
                            const parsed = JSON.parse(show.episodesPerSeason);
                            if (Array.isArray(parsed)) {
                              return `Custom (${parsed.join(', ')})`;
                            }
                            return show.episodesPerSeason;
                          } catch (e) {
                            return show.episodesPerSeason;
                          }
                        })()
                      : '12'}
                  </span>
                  <EpisodesPerSeasonEditor 
                    showId={show.id}
                    showTitle={show.title}
                    initialEpisodesPerSeason={show.episodesPerSeason || '12'}
                    onUpdate={handleEpisodesPerSeasonUpdate}
                  />
                </div>
              </div>
            </div>
            
            <h3 className="text-lg font-semibold mt-4">Episodes</h3>
            
            {episodesLoading ? (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : episodesError ? (
              <div className="text-destructive">{episodesError}</div>
            ) : Object.keys(episodesBySeason).length === 0 ? (
              <div className="text-muted-foreground">No episodes found for this show.</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(episodesBySeason).map(([seasonStr, seasonEpisodes]) => {
                  const season = parseInt(seasonStr);
                  const isExpanded = expandedSeasons[season];
                  const downloadedInSeason = seasonEpisodes.filter(ep => ep.isDownloaded).length;
                  const totalInSeason = seasonEpisodes.length;
                  
                  return (
                    <div key={`season-${season}`} className="border rounded-md overflow-hidden">
                      <div 
                        className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSeasonCollapse(season)}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />
                          }
                          <h4 className="font-medium">Season {season}</h4>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {downloadedInSeason}/{totalInSeason} episodes
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {seasonEpisodes.map((episode) => (
                              <div
                                key={episode.id}
                                className={`p-3 rounded-md border cursor-pointer transition-colors ${
                                  episode.isDownloaded 
                                    ? 'bg-success/10 hover:bg-success/20 border-success/30' 
                                    : 'hover:bg-accent/50'
                                }`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleEpisodeStatus(episode);
                                }}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">
                                    Episode {episode.episodeInSeason} 
                                    <span className="text-xs text-muted-foreground ml-1">
                                      (#{episode.episodeNumber})
                                    </span>
                                  </span>
                                  <Badge variant={episode.isDownloaded ? "success" : "outline"}>
                                    {episode.isDownloaded ? 'Downloaded' : 'Needed'}
                                  </Badge>
                                </div>
                                {episode.magnetLink && (
                                  <div className="mt-2">
                                    <a 
                                      href="#"
                                      className="text-xs text-blue-500 hover:underline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        
                                        if (episode.magnetLink) {
                                          // Try to open the magnet link
                                          const opened = window.open(episode.magnetLink);
                                          
                                          // If window.open returns null or undefined, or browser blocks it
                                          if (!opened) {
                                            // Fallback to location.href
                                            window.location.href = episode.magnetLink;
                                          }
                                        }
                                      }}
                                    >
                                      Open Magnet Link
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 