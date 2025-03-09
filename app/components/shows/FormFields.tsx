import React from 'react';
import { Badge } from '@/app/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface Show {
  id?: number;
  title: string;
  alternateNames: string; // JSON string of alternate names
  episodesPerSeason: string; // Number or JSON array of numbers
  startSeason: number;
  startEpisode: number;
  endSeason: number;
  endEpisode: number;
  quality: string;
  status: string;
}

interface FormFieldsProps {
  show: Show;
  alternateNames: string[];
  newAlternateName: string;
  isEpisodesPerSeasonArray: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  setNewAlternateName: (value: string) => void;
  addAlternateName: () => void;
  removeAlternateName: (index: number) => void;
  setIsEpisodesPerSeasonArray: (value: boolean) => void;
}

export function FormFields({
  show,
  alternateNames,
  newAlternateName,
  isEpisodesPerSeasonArray,
  handleChange,
  setNewAlternateName,
  addAlternateName,
  removeAlternateName,
  setIsEpisodesPerSeasonArray
}: FormFieldsProps) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={show.title}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Alternate Names
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {alternateNames.map((name, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1 py-1.5">
              {name}
              <button
                type="button"
                onClick={() => removeAlternateName(index)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newAlternateName}
            onChange={(e) => setNewAlternateName(e.target.value)}
            className="flex-1 p-2 border rounded-md"
            placeholder="Add alternate name"
          />
          <Button
            type="button"
            onClick={addAlternateName}
            disabled={!newAlternateName.trim()}
            variant="outline"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Episodes Per Season
        </label>
        <div className="flex items-center gap-2 mb-2">
          <label className="flex items-center">
            <input
              type="radio"
              checked={!isEpisodesPerSeasonArray}
              onChange={() => setIsEpisodesPerSeasonArray(false)}
              className="mr-1"
            />
            <span className="text-sm">Single Value</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              checked={isEpisodesPerSeasonArray}
              onChange={() => setIsEpisodesPerSeasonArray(true)}
              className="mr-1"
            />
            <span className="text-sm">Array (comma separated)</span>
          </label>
        </div>
        <input
          type="text"
          id="episodesPerSeason"
          name="episodesPerSeason"
          value={show.episodesPerSeason}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          placeholder={isEpisodesPerSeasonArray ? "12, 13, 12" : "12"}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startSeason" className="block text-sm font-medium mb-1">
            Start Season
          </label>
          <input
            type="number"
            id="startSeason"
            name="startSeason"
            value={show.startSeason}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            min="1"
            required
          />
        </div>
        <div>
          <label htmlFor="startEpisode" className="block text-sm font-medium mb-1">
            Start Episode
          </label>
          <input
            type="number"
            id="startEpisode"
            name="startEpisode"
            value={show.startEpisode}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            min="1"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="endSeason" className="block text-sm font-medium mb-1">
            End Season
          </label>
          <input
            type="number"
            id="endSeason"
            name="endSeason"
            value={show.endSeason}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            min={show.startSeason}
            required
          />
        </div>
        <div>
          <label htmlFor="endEpisode" className="block text-sm font-medium mb-1">
            End Episode
          </label>
          <input
            type="number"
            id="endEpisode"
            name="endEpisode"
            value={show.endEpisode}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            min="1"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="quality" className="block text-sm font-medium mb-1">
          Quality
        </label>
        <select
          id="quality"
          name="quality"
          value={show.quality}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        >
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
          <option value="2160p">2160p (4K)</option>
        </select>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium mb-1">
          Status
        </label>
        <select
          id="status"
          name="status"
          value={show.status}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        >
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="upcoming">Upcoming</option>
          <option value="hiatus">Hiatus</option>
        </select>
      </div>
    </div>
  );
} 