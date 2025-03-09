import React from 'react';
import { Button } from '@/app/components/ui/button';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ShowListFiltersProps {
  onRefresh: () => void;
  loading: boolean;
}

export function ShowListFilters({ onRefresh, loading }: ShowListFiltersProps) {
  const router = useRouter();

  return (
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold">My Shows</h2>
      <div className="flex space-x-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
        <Button variant="default" size="sm" onClick={() => router.push('/shows/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Show
        </Button>
      </div>
    </div>
  );
}
