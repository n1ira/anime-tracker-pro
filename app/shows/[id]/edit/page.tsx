import { ShowForm } from '@/app/components/ShowForm';
import { notFound } from 'next/navigation';

export default function EditShowPage({ params }: { params: { id: string } }) {
  const showId = parseInt(params.id);

  // Redirect to not found if the ID is invalid
  if (isNaN(showId)) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4">
      <ShowForm showId={showId} isEditing={true} />
    </div>
  );
}
