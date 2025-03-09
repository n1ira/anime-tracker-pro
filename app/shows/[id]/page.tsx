import { ShowDetail } from '@/app/components/ShowDetail';
import { notFound } from 'next/navigation';

export default function ShowDetailPage({ params }: { params: { id: string } }) {
  const showId = parseInt(params.id);

  // Redirect to not found if the ID is invalid
  if (isNaN(showId)) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4">
      <ShowDetail showId={showId} />
    </div>
  );
}
