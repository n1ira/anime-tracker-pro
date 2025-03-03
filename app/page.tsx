import { ShowsList } from './components/ShowsList';
import { ScanController } from './components/ScanController';
import { LogViewer } from './components/LogViewer';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Home() {
  return (
    <main className="container mx-auto py-6 px-4 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Anime Tracker</h1>
        <ThemeToggle />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <ShowsList />
        </div>
        <div>
          <ScanController />
        </div>
      </div>
      
      <div>
        <LogViewer />
      </div>
    </main>
  );
}
