// Types for show-related hooks
export type Show = {
  id: number;
  title: string;
  directory: string;
  regex: string;
  episodesPerSeason?: Record<string, number>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
};

export type Episode = {
  id: number;
  showId: number;
  season: number;
  episode: number;
  absoluteEpisode: number;
  title: string;
  path: string;
  isWatched: boolean;
  createdAt: string;
  updatedAt: string;
};
