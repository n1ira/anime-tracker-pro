import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Button } from './button';
import Link from 'next/link';

interface ShowCardProps {
  id: string;
  title: string;
  status?: string;
  episodeCount?: number;
  totalEpisodes?: number;
  onScan?: () => void;
  isScanning?: boolean;
}

export function ShowCard({
  id,
  title,
  status,
  episodeCount = 0,
  totalEpisodes,
  onScan,
  isScanning = false,
}: ShowCardProps) {
  const progress = totalEpisodes ? Math.round((episodeCount / totalEpisodes) * 100) : 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg line-clamp-2">{title}</CardTitle>
          {status && (
            <Badge variant={status === 'Completed' ? 'success' : 'default'}>{status}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        {totalEpisodes ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>
                {episodeCount} / {totalEpisodes} episodes
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No episode data</p>
        )}
      </CardContent>
      <CardFooter className="pt-2 flex justify-between">
        <Button variant="outline" asChild>
          <Link href={`/shows/${id}`}>View Details</Link>
        </Button>
        {onScan && (
          <Button variant="secondary" onClick={onScan} disabled={isScanning}>
            {isScanning ? 'Scanning...' : 'Scan'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
