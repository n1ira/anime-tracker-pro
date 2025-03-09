import React from 'react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Play, Loader2 } from 'lucide-react';

interface Episode {
  id: number;
  showId: number;
  episodeNumber: number;
  isDownloaded: boolean;
  magnetLink?: string;
  season?: number;
  episodeInSeason?: number;
}

interface EpisodeItemProps {
  episode: Episode;
  onToggle: (episode: Episode) => Promise<void>;
  loading: boolean;
  episodeLoading: Record<number, boolean>;
}

export function EpisodeItem({ episode, onToggle, loading, episodeLoading }: EpisodeItemProps) {
  const isLoading = episodeLoading[episode.id] || false;

  return (
    <div
      key={episode.id}
      className={`flex items-center justify-between p-2 rounded-md ${
        episode.isDownloaded ? 'bg-green-100 dark:bg-green-900/20' : 'bg-muted/30'
      }`}
    >
      <div className="flex items-center">
        <Badge variant={episode.isDownloaded ? 'success' : 'outline'} className="mr-2">
          {episode.season && episode.episodeInSeason
            ? `S${episode.season}E${episode.episodeInSeason}`
            : `Episode ${episode.episodeNumber}`}
        </Badge>
        {episode.magnetLink && (
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-0 h-auto"
            onClick={e => {
              e.stopPropagation();
              window.open(episode.magnetLink, '_blank');
            }}
          >
            <Play className="h-3 w-3 mr-1" />
            Play
          </Button>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onToggle(episode)}
        disabled={loading || isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : episode.isDownloaded ? (
          'Mark as Not Downloaded'
        ) : (
          'Mark as Downloaded'
        )}
      </Button>
    </div>
  );
}
