import React from 'react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Edit, ExternalLink, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Show {
  id: number;
  title: string;
  status: string;
  lastScanned?: string;
}

interface EpisodesBySeason {
  [season: number]: {
    total: number;
    downloaded: number;
  };
}

interface ShowListItemProps {
  show: Show;
  currentEpisode: number;
  totalEpisodes: number;
  seasonData: EpisodesBySeason;
  onDelete: (showId: number) => void;
  onShowClick: (showId: number, e: React.MouseEvent) => void;
}

export function ShowListItem({
  show,
  currentEpisode,
  totalEpisodes,
  seasonData,
  onDelete,
  onShowClick,
}: ShowListItemProps) {
  const router = useRouter();
  const hasMultipleSeasons = Object.keys(seasonData || {}).length > 1;

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

  const renderEpisodesCount = () => {
    // If we don't have season data yet or it's just one season, show the simple count
    if (!seasonData || Object.keys(seasonData).length <= 1) {
      return (
        <span className="text-sm text-muted-foreground">
          Episodes: {currentEpisode}/{totalEpisodes || '?'}
        </span>
      );
    }

    // For multiple seasons, show the breakdown
    return (
      <div className="text-sm text-muted-foreground">
        <span>
          Total: {currentEpisode}/{totalEpisodes}
        </span>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(seasonData).map(([season, data]) => (
            <Badge key={`${show.id}-s${season}`} variant="outline" className="text-xs">
              S{season}: {data.downloaded}/{data.total}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-md border hover:bg-accent/50 cursor-pointer transition-colors shadow-sm ${
        hasMultipleSeasons ? 'flex-col items-start' : ''
      }`}
      onClick={e => onShowClick(show.id, e)}
    >
      <div
        className={`flex ${hasMultipleSeasons ? 'flex-col w-full' : 'items-center justify-between w-full'}`}
      >
        <div className={`flex ${hasMultipleSeasons ? 'flex-col' : 'flex-col flex-grow'}`}>
          <span className="font-medium text-lg">{show.title}</span>
          {renderEpisodesCount()}
        </div>

        <div
          className={`flex items-center ${hasMultipleSeasons ? 'mt-2 w-full justify-between' : 'space-x-2'}`}
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
                onDelete(show.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
