import React from 'react';
import { Button } from '@/app/components/ui/button';
import { Edit, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ShowActionsProps {
  showId: number;
  onBack: () => void;
}

export function ShowActions({ showId, onBack }: ShowActionsProps) {
  const router = useRouter();

  return (
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
  );
}
