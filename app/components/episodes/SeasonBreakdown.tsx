import React from 'react';

interface SeasonBreakdownProps {
  episodesPerSeasonValue: string;
}

export function SeasonBreakdown({ episodesPerSeasonValue }: SeasonBreakdownProps) {
  return (
    <div className="mb-4">
      <h4 className="font-medium mb-2">Season Breakdown:</h4>
      <div className="space-y-1">
        {episodesPerSeasonValue
          .split(',')
          .map((value, index) => {
            const num = Number(value.trim());
            return !isNaN(num) ? (
              <div key={index} className="text-sm">
                Season {index + 1}: {num} episodes
              </div>
            ) : null;
          })
          .filter(Boolean)}
      </div>
    </div>
  );
}
