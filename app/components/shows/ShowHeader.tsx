import React from 'react';
import { CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { RefreshCw, ArrowLeft, Edit, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

interface ShowHeaderProps {
  show: Show;
  showId: number;
  currentEpisode: number;
  totalEpisodes: number | null;
  onScan: () => Promise<void>;
  onBack: () => void;
  loading: boolean;
  scanLoading: boolean;
}

export function ShowHeader({ 
  show, 
  showId, 
  currentEpisode, 
  totalEpisodes, 
  onScan, 
  onBack, 
  loading, 
  scanLoading 
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
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 text-transparent bg-clip-text">{show.title}</CardTitle>
          <CardDescription>
            Status: {show.status} | Episodes: {currentEpisode}/{totalEpisodes || '?'} 
            {(show.startSeason && show.endSeason) ? (
              <> | Seasons: {show.startSeason} - {show.endSeason}</>
            ) : null}
          </CardDescription>
          {show.lastScanned && (
            <div className="text-sm text-muted-foreground mt-1">
              Last scanned: {new Date(show.lastScanned).toLocaleString()}
            </div>
          )}
        </div>
        <Button 
          onClick={onScan} 
          disabled={scanLoading}
          className="ml-auto"
        >
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