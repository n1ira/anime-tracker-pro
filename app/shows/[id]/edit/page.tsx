import { ShowForm } from '@/app/components/ShowForm';

export default function EditShowPage({ params }: { params: { id: string } }) {
  const showId = parseInt(params.id);
  
  return (
    <main className="container mx-auto py-6 px-4">
      <ShowForm showId={showId} isEditing={true} />
    </main>
  );
} 