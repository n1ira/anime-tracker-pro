import { ShowForm } from '@/app/components/ShowForm';
import { ThemeToggle } from '@/components/theme-toggle';

export default function NewShowPage() {
  return (
    <main className="container mx-auto py-6 px-4">
      <div className="flex justify-end mb-4">
        <ThemeToggle />
      </div>
      <ShowForm />
    </main>
  );
} 