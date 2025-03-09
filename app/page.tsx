import { ShowsList } from './components/ShowsList';
import { ScanController } from './components/ScanController';
import { LogViewer } from './components/LogViewer';

export default function Home() {
  return (
    <div className="container mx-auto px-4 space-y-8">
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
    </div>
  );
}
