"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { useRouter } from 'next/navigation';
import { getSeasonAndEpisode } from '@/app/utils/episodeCalculator';
import { ShowListItem } from './ShowListItem';
import { ShowListFilters } from './ShowListFilters';
import { ShowListPagination } from './ShowListPagination';
import { useShows, Show } from '@/app/contexts/shows-context';
import { useScan } from '@/app/contexts/scan-context';
import { LoadingState } from '@/app/components/ui/loading-state';
import { EmptyState } from '@/app/components/ui/empty-state';
import { SectionHeader } from '@/app/components/ui/section-header';
import { PlusCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";

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
  const { shows, isLoading, error, refreshShows } = useShows();
  const scanContext = useScan();
  const scanState = scanContext.scanState;
  const isScanning = scanState?.isScanning || false;
  
  const [episodes, setEpisodes] = useState<Record<number, Episode[]>>({});
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, EpisodesBySeason>>({});
  const [showIdToDelete, setShowIdToDelete] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const router = useRouter();

  // Fetch episodes for each show
  useEffect(() => {
    const fetchEpisodes = async () => {
      const episodesData: Record<number, Episode[]> = {};
      for (const show of shows) {
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
    };

    if (shows.length > 0) {
      fetchEpisodes();
    }
  }, [shows]);

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
      
      showEpisodes.forEach((episode: Episode) => {
        const { season } = getSeasonAndEpisode(
          episode.episodeNumber,
          show.title,
          { [show.title]: { episodes_per_season: episodesPerSeason } }
        );
        
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

  const handleDeleteShow = async () => {
    if (!showIdToDelete) return;
    
    try {
      const response = await fetch(`/api/shows/${showIdToDelete}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete show');
      }
      
      // Refresh shows after deletion
      refreshShows();
      setShowIdToDelete(null);
    } catch (err) {
      console.error('Error deleting show:', err);
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

  // Pagination logic
  const totalPages = Math.ceil(shows.length / itemsPerPage);
  const paginatedShows = shows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  return (
    <>
      <SectionHeader 
        title="Your Shows" 
        description="Manage and track your anime collection"
        actions={
          <ShowListFilters onRefresh={refreshShows} loading={isLoading || isScanning} />
        }
      />

      <Card className="shadow-md">
        <CardContent className="pt-6">
          <LoadingState isLoading={isLoading} error={error}>
            {shows.length === 0 ? (
              <EmptyState
                title="No shows found"
                description="Add your first anime show to start tracking"
                actionLabel="Add Show"
                onAction={() => router.push('/shows/new')}
                icon={<PlusCircle className="h-10 w-10" />}
              />
            ) : (
              <div className="grid gap-3">
                {paginatedShows.map((show) => (
                  <ShowListItem
                    key={show.id}
                    show={show}
                    currentEpisode={getCurrentEpisode(show.id)}
                    totalEpisodes={getTotalEpisodes(show.id)}
                    seasonData={episodesBySeason[show.id] || {}}
                    onDelete={setShowIdToDelete}
                    onShowClick={handleShowClick}
                  />
                ))}
              </div>
            )}
            
            {shows.length > itemsPerPage && (
              <ShowListPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </LoadingState>
        </CardContent>
      </Card>

      <AlertDialog open={!!showIdToDelete} onOpenChange={(open) => {
        if (!open) setShowIdToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this show and all its episodes.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteShow}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 