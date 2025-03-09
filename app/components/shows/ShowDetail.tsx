"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/app/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getSeasonAndEpisode } from '@/app/utils/episodeCalculator';
import { ShowHeader } from './ShowHeader';
import { SeasonEpisodeList } from '../episodes/SeasonEpisodeList';
import { Button } from '@/app/components/ui/button';

// Dynamically import the EpisodesPerSeasonEditor component
const EpisodesPerSeasonEditor = dynamic(() => import('../EpisodesPerSeasonEditor'), {
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
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [episodeLoading, setEpisodeLoading] = useState<Record<number, boolean>>({});
  const router = useRouter();

  // Calculate current and total episodes
  const currentEpisode = episodes.filter(e => e.isDownloaded).length;
  const totalEpisodes = episodes.length > 0 ? episodes.length : null;

  const fetchShow = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/shows/${showId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch show');
      }
      const data = await response.json();
      setShow(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [showId]);

  const fetchEpisodes = useCallback(async () => {
    try {
      setEpisodesLoading(true);
      const response = await fetch(`/api/shows/${showId}/episodes`);
      if (!response.ok) {
        throw new Error('Failed to fetch episodes');
      }
      const data = await response.json();
      setEpisodes(data);
      
      // Group episodes by season
      const groupedEpisodes: Record<number, Episode[]> = {};
      data.forEach((episode: Episode) => {
        // Use a default value of "12" if episodesPerSeason is undefined
        const episodesPerSeason = show?.episodesPerSeason || "12";
        const { season } = getSeasonAndEpisode(episode.episodeNumber, episodesPerSeason);
        if (!groupedEpisodes[season]) {
          groupedEpisodes[season] = [];
        }
        groupedEpisodes[season].push({
          ...episode,
          season,
          episodeInSeason: getSeasonAndEpisode(episode.episodeNumber, episodesPerSeason).episode
        });
      });
      
      setEpisodesBySeason(groupedEpisodes);
      
      // Initialize expanded state for seasons
      const initialExpandedState: Record<number, boolean> = {};
      Object.keys(groupedEpisodes).forEach(season => {
        initialExpandedState[Number(season)] = true; // Default to expanded
      });
      setExpandedSeasons(initialExpandedState);
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setEpisodesLoading(false);
    }
  }, [showId, show?.episodesPerSeason]);

  useEffect(() => {
    fetchShow();
  }, [fetchShow]);

  useEffect(() => {
    if (show) {
      fetchEpisodes();
    }
  }, [show, fetchEpisodes]);

  const toggleSeasonCollapse = (season: number) => {
    setExpandedSeasons(prev => ({
      ...prev,
      [season]: !prev[season]
    }));
  };

  const toggleEpisodeStatus = async (episode: Episode) => {
    try {
      setEpisodeLoading(prev => ({ ...prev, [episode.id]: true }));
      
      const response = await fetch(`/api/shows/${showId}/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isDownloaded: !episode.isDownloaded
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update episode status');
      }
      
      // Update local state
      setEpisodes(prev => 
        prev.map(ep => 
          ep.id === episode.id 
            ? { ...ep, isDownloaded: !ep.isDownloaded } 
            : ep
        )
      );
      
      // Update episodes by season
      setEpisodesBySeason(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(season => {
          newState[Number(season)] = newState[Number(season)].map(ep => 
            ep.id === episode.id 
              ? { ...ep, isDownloaded: !ep.isDownloaded } 
              : ep
          );
        });
        return newState;
      });
      
    } catch (err) {
      console.error('Error updating episode:', err);
    } finally {
      setEpisodeLoading(prev => ({ ...prev, [episode.id]: false }));
    }
  };

  const startSingleShowScan = async () => {
    try {
      setScanLoading(true);
      const response = await fetch(`/api/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          showId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to start scan');
      }
      
      // Wait a bit and then refresh the data
      setTimeout(() => {
        fetchShow();
        fetchEpisodes();
        setScanLoading(false);
      }, 2000);
      
    } catch (err) {
      console.error('Error starting scan:', err);
      setScanLoading(false);
    }
  };

  const handleEpisodesPerSeasonUpdate = (newValue: string) => {
    if (show) {
      // Update the show with the new episodesPerSeason value
      fetch(`/api/shows/${showId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          episodesPerSeason: newValue
        }),
      }).then(response => {
        if (response.ok) {
          // Update local state
          setShow({
            ...show,
            episodesPerSeason: newValue
          });
          // Refresh show data to reflect the changes
          fetchShow();
        }
      });
    }
  };

  const handleBack = () => {
    router.back();
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
      <ShowHeader 
        show={show}
        showId={showId}
        currentEpisode={currentEpisode}
        totalEpisodes={totalEpisodes}
        onScan={startSingleShowScan}
        onBack={handleBack}
        loading={loading}
        scanLoading={scanLoading}
      />

      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Episodes</h3>
            {show.episodesPerSeason && (
              <EpisodesPerSeasonEditor
                showId={show.id}
                showTitle={show.title}
                initialEpisodesPerSeason={show.episodesPerSeason}
                onUpdate={handleEpisodesPerSeasonUpdate}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {episodesLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : episodes.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No episodes found for this show.
            </div>
          ) : (
            <SeasonEpisodeList
              episodesBySeason={episodesBySeason}
              expandedSeasons={expandedSeasons}
              onToggleSeason={toggleSeasonCollapse}
              onToggleEpisode={toggleEpisodeStatus}
              loading={loading}
              episodeLoading={episodeLoading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
} 