# Custom React Hooks Documentation

This document provides detailed information about the custom React hooks available in the Anime Tracker Pro application.

## Table of Contents

- [Show Hooks](#show-hooks)
  - [useShowData](#useshowdata)
  - [useEpisodeData](#useepisodedata)
- [Scan Hooks](#scan-hooks)
  - [useScanState](#usescanstate)
  - [useScanStatus](#usescanstatus)
  - [useScanControl](#usescancontrol)
- [Log Hooks](#log-hooks)
  - [useLogStream](#uselogstream)
  - [useLogFilter](#uselogfilter)
  - [useLogFetch](#uselogfetch)

## Show Hooks

### useShowData

Hook for fetching and managing show data.

```tsx
import { useShowData } from '@/app/hooks/shows/useShowData';

// Get all shows
const { shows, isLoading, error, mutate } = useShowData();

// Get a specific show
const { show, isLoading, error, mutate } = useShowData(showId);
```

#### Parameters

- `showId` (optional): The ID of the show to fetch. If not provided, all shows will be fetched.

#### Returns

- `shows`: Array of show objects (when no showId is provided)
- `show`: Single show object (when showId is provided)
- `isLoading`: Boolean indicating if the data is being fetched
- `error`: Error object if the fetch failed
- `mutate`: Function to manually refetch the data

#### Example

```tsx
import { useShowData } from '@/app/hooks/shows/useShowData';

function ShowsList() {
  const { shows, isLoading, error } = useShowData();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading shows</div>;

  return (
    <div>
      {shows.map(show => (
        <div key={show.id}>{show.title}</div>
      ))}
    </div>
  );
}
```

### useEpisodeData

Hook for fetching and managing episode data for a show.

```tsx
import { useEpisodeData } from '@/app/hooks/shows/useEpisodeData';

const { episodes, episodesBySeason, isLoading, error, mutate, toggleEpisode } = useEpisodeData(showId);
```

#### Parameters

- `showId`: The ID of the show to fetch episodes for.

#### Returns

- `episodes`: Array of episode objects
- `episodesBySeason`: Object with season numbers as keys and arrays of episodes as values
- `isLoading`: Boolean indicating if the data is being fetched
- `error`: Error object if the fetch failed
- `mutate`: Function to manually refetch the data
- `toggleEpisode`: Function to toggle the downloaded status of an episode

#### Example

```tsx
import { useEpisodeData } from '@/app/hooks/shows/useEpisodeData';

function EpisodesList({ showId }) {
  const { episodesBySeason, isLoading, toggleEpisode } = useEpisodeData(showId);

  if (isLoading) return <div>Loading episodes...</div>;

  return (
    <div>
      {Object.entries(episodesBySeason).map(([season, episodes]) => (
        <div key={season}>
          <h3>Season {season}</h3>
          {episodes.map(episode => (
            <div 
              key={episode.id} 
              onClick={() => toggleEpisode(episode.id, !episode.downloaded)}
            >
              Episode {episode.episode}: {episode.downloaded ? 'Downloaded' : 'Not Downloaded'}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

## Scan Hooks

### useScanState

Hook for managing the complete scan state, combining status and control.

```tsx
import { useScanState } from '@/app/hooks/scan/useScanState';

const { 
  isScanning, 
  status, 
  currentShowId, 
  currentShow,
  startScan, 
  stopScan, 
  isLoading 
} = useScanState();
```

#### Returns

- `isScanning`: Boolean indicating if a scan is in progress
- `status`: String indicating the current scan status
- `currentShowId`: ID of the show currently being scanned
- `currentShow`: Object containing details of the show currently being scanned
- `startScan`: Function to start a scan
- `stopScan`: Function to stop a scan
- `isLoading`: Boolean indicating if the scan state is being fetched

#### Example

```tsx
import { useScanState } from '@/app/hooks/scan/useScanState';

function ScanController() {
  const { isScanning, status, startScan, stopScan } = useScanState();

  return (
    <div>
      <div>Status: {status}</div>
      {isScanning ? (
        <button onClick={stopScan}>Stop Scan</button>
      ) : (
        <button onClick={() => startScan()}>Start Scan</button>
      )}
    </div>
  );
}
```

### useScanStatus

Hook for fetching the current scan status.

```tsx
import { useScanStatus } from '@/app/hooks/scan/useScanStatus';

const { isScanning, status, currentShowId, isLoading, error, mutate } = useScanStatus();
```

#### Returns

- `isScanning`: Boolean indicating if a scan is in progress
- `status`: String indicating the current scan status
- `currentShowId`: ID of the show currently being scanned
- `isLoading`: Boolean indicating if the data is being fetched
- `error`: Error object if the fetch failed
- `mutate`: Function to manually refetch the data

### useScanControl

Hook for controlling the scanning process.

```tsx
import { useScanControl } from '@/app/hooks/scan/useScanControl';

const { startScan, stopScan, isLoading, error } = useScanControl();
```

#### Returns

- `startScan`: Function to start a scan
- `stopScan`: Function to stop a scan
- `isLoading`: Boolean indicating if a scan operation is in progress
- `error`: Error object if the operation failed

## Log Hooks

### useLogStream

Hook for streaming logs in real-time.

```tsx
import { useLogStream } from '@/app/hooks/logs/useLogStream';

const { logs, isConnected } = useLogStream();
```

#### Returns

- `logs`: Array of log objects received from the stream
- `isConnected`: Boolean indicating if the stream is connected

#### Example

```tsx
import { useLogStream } from '@/app/hooks/logs/useLogStream';

function LiveLogs() {
  const { logs, isConnected } = useLogStream();

  return (
    <div>
      <div>Connection status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <div>
        {logs.map((log, index) => (
          <div key={index}>
            [{log.timestamp}] {log.level}: {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### useLogFilter

Hook for filtering logs by level and other criteria.

```tsx
import { useLogFilter } from '@/app/hooks/logs/useLogFilter';

const { 
  filters, 
  setLevelFilter, 
  setShowIdFilter, 
  setOriginFilter, 
  resetFilters 
} = useLogFilter();
```

#### Returns

- `filters`: Object containing the current filter values
- `setLevelFilter`: Function to set the log level filter
- `setShowIdFilter`: Function to set the show ID filter
- `setOriginFilter`: Function to set the origin filter
- `resetFilters`: Function to reset all filters

#### Example

```tsx
import { useLogFilter } from '@/app/hooks/logs/useLogFilter';

function LogFilters() {
  const { filters, setLevelFilter, resetFilters } = useLogFilter();

  return (
    <div>
      <select 
        value={filters.level || ''} 
        onChange={e => setLevelFilter(e.target.value || null)}
      >
        <option value="">All Levels</option>
        <option value="debug">Debug</option>
        <option value="info">Info</option>
        <option value="warning">Warning</option>
        <option value="error">Error</option>
      </select>
      <button onClick={resetFilters}>Reset Filters</button>
    </div>
  );
}
```

### useLogFetch

Hook for fetching logs from the database.

```tsx
import { useLogFetch } from '@/app/hooks/logs/useLogFetch';

const { 
  logs, 
  total, 
  isLoading, 
  error, 
  page, 
  setPage, 
  limit, 
  setLimit, 
  filters, 
  setFilters 
} = useLogFetch();
```

#### Returns

- `logs`: Array of log objects
- `total`: Total number of logs matching the filters
- `isLoading`: Boolean indicating if the data is being fetched
- `error`: Error object if the fetch failed
- `page`: Current page number
- `setPage`: Function to change the page
- `limit`: Number of logs per page
- `setLimit`: Function to change the limit
- `filters`: Object containing the current filter values
- `setFilters`: Function to set all filters at once

#### Example

```tsx
import { useLogFetch } from '@/app/hooks/logs/useLogFetch';

function LogViewer() {
  const { 
    logs, 
    total, 
    isLoading, 
    page, 
    setPage, 
    limit, 
    setLimit 
  } = useLogFetch();

  if (isLoading) return <div>Loading logs...</div>;

  return (
    <div>
      <div>
        {logs.map(log => (
          <div key={log.id}>
            [{log.timestamp}] {log.level}: {log.message}
          </div>
        ))}
      </div>
      <div>
        Showing {logs.length} of {total} logs
      </div>
      <div>
        <button 
          disabled={page === 1} 
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button 
          disabled={page * limit >= total} 
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
        <select 
          value={limit} 
          onChange={e => setLimit(Number(e.target.value))}
        >
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>
    </div>
  );
}
``` 