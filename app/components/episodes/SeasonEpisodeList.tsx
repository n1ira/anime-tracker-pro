import React from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { EpisodeItem } from './EpisodeItem';

interface Episode {
  id: number;
  showId: number;
  episodeNumber: number;
  isDownloaded: boolean;
  magnetLink?: string;
  season?: number;
  episodeInSeason?: number;
}

interface SeasonEpisodeListProps {
  episodesBySeason: Record<number, Episode[]>;
  expandedSeasons: Record<number, boolean>;
  onToggleSeason: (season: number) => void;
  onToggleEpisode: (episode: Episode) => Promise<void>;
  loading: boolean;
  episodeLoading: Record<number, boolean>;
}

export function SeasonEpisodeList({
  episodesBySeason,
  expandedSeasons,
  onToggleSeason,
  onToggleEpisode,
  loading,
  episodeLoading,
}: SeasonEpisodeListProps) {
  // Sort seasons in ascending order
  const sortedSeasons = Object.keys(episodesBySeason)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {sortedSeasons.map(season => {
        const episodes = episodesBySeason[season];
        const isExpanded = expandedSeasons[season] || false;

        return (
          <Card key={season} className="shadow-sm">
            <div
              className="flex items-center justify-between p-4 cursor-pointer border-b"
              onClick={() => onToggleSeason(season)}
            >
              <div className="flex items-center">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                <h3 className="font-medium">Season {season}</h3>
                <span className="ml-2 text-sm text-muted-foreground">
                  ({episodes.filter(e => e.isDownloaded).length}/{episodes.length} episodes)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  onToggleSeason(season);
                }}
              >
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </div>

            {isExpanded && (
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {episodes
                    .sort((a, b) => (a.episodeInSeason || 0) - (b.episodeInSeason || 0))
                    .map(episode => (
                      <EpisodeItem
                        key={episode.id}
                        episode={episode}
                        onToggle={onToggleEpisode}
                        loading={loading}
                        episodeLoading={episodeLoading}
                      />
                    ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
