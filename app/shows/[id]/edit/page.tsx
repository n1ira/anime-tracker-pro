import { ShowForm } from '@/app/components/ShowForm';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from '@/app/components/ui/error-boundary';

export default function EditShowPage({ params }: { params: { id: string } }) {
  const showId = parseInt(params.id);

  // Redirect to not found if the ID is invalid
  if (isNaN(showId)) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4">
      <ErrorBoundary>
        <Suspense fallback={
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }>
          <ShowForm showId={showId} isEditing={true} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
