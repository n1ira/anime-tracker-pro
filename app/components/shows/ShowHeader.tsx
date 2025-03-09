import React from 'react';
import { CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { RefreshCw, ArrowLeft, Edit, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Interface representing a show object
 * @interface Show
 */
interface Show {
  /** Unique identifier for the show */
  id: number;
  /** Title of the show */
  title: string;
  /** Current status of the show (ongoing, completed, paused) */
  status: string;
  /** ISO timestamp of when the show was last scanned */
  lastScanned?: string;
  /** JSON string representing the number of episodes per season */
  episodesPerSeason?: string;
  /** Starting season to track */
  startSeason?: number;
  /** Ending season to track */
  endSeason?: number;
  /** Starting episode to track */
  startEpisode?: number;
  /** Ending episode to track */
  endEpisode?: number;
}

/**
 * Props for the ShowHeader component
 * @interface ShowHeaderProps
 */
interface ShowHeaderProps {
  /** Show object containing details about the anime */
  show: Show;
  /** Unique identifier for the show */
  showId: number;
  /** Current episode number the user is on */
  currentEpisode: number;
  /** Total number of episodes for the show, or null if unknown */
  totalEpisodes: number | null;
  /** Function to trigger scanning for new episodes */
  onScan: () => Promise<void>;
  /** Function to navigate back to the shows list */
  onBack: () => void;
  /** Whether the component is in a loading state */
  loading: boolean;
  /** Whether a scan is currently in progress */
  scanLoading: boolean;
}

/**
 * Header component for the show detail page
 * 
 * Displays the show title, status, progress, and action buttons
 * for navigating back, editing the show, and scanning for new episodes.
 * 
 * @param {ShowHeaderProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
export function ShowHeader({
  show,
  showId,
  currentEpisode,
  totalEpisodes,
  onScan,
  onBack,
  loading,
  scanLoading,
}: ShowHeaderProps) {
  const router = useRouter();

  return (
    <>
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
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

      <div className="flex justify-between items-start">
        <div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 text-transparent bg-clip-text">
            {show.title}
          </CardTitle>
          <CardDescription>
            Status: {show.status} | Episodes: {currentEpisode}/{totalEpisodes || '?'}
            {show.startSeason && show.endSeason ? (
              <>
                {' '}
                | Seasons: {show.startSeason} - {show.endSeason}
              </>
            ) : null}
          </CardDescription>
          {show.lastScanned && (
            <div className="text-sm text-muted-foreground mt-1">
              Last scanned: {new Date(show.lastScanned).toLocaleString()}
            </div>
          )}
        </div>
        <Button onClick={onScan} disabled={scanLoading} className="ml-auto">
          {scanLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Scan Now
            </>
          )}
        </Button>
      </div>
    </>
  );
}
