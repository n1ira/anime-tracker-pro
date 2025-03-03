import { ShowForm } from '@/app/components/ShowForm';
import { ThemeToggle } from '@/components/theme-toggle';
import { notFound } from 'next/navigation';

export default function EditShowPage({ params }: { params: { id: string } }) {
  const showId = parseInt(params.id);
  
  // Redirect to not found if the ID is invalid
  if (isNaN(showId)) {
    notFound();
  }
  
  return (
    <main className="container mx-auto py-6 px-4">
      <div className="flex justify-end mb-4">
        <ThemeToggle />
      </div>
      <ShowForm showId={showId} isEditing={true} />
    </main>
  );
} 