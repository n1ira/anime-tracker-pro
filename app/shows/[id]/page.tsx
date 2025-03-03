import { ShowDetail } from '@/app/components/ShowDetail';

export default function ShowDetailPage({ params }: { params: { id: string } }) {
  const showId = parseInt(params.id);
  
  return (
    <main className="container mx-auto py-6 px-4">
      <ShowDetail showId={showId} />
    </main>
  );
} 