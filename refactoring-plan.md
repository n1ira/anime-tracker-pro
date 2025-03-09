# Anime Tracker Pro Refactoring Plan

This document outlines a plan to simplify and refactor the Anime Tracker Pro project, identifying areas where code can be removed, refactored, or restructured for better maintainability and performance.

## Project Structure Before Refactoring started

```
.
├── .cursor/
│   └── rules/
│       └── general.mdc
├── .git/
├── .next/
├── app/
│   ├── api/
│   │   ├── logs/
│   │   │   ├── route.ts
│   │   │   └── sse/
│   │   │       └── route.ts
│   │   ├── scan/
│   │   │   ├── events/
│   │   │   │   └── route.ts
│   │   ├── status/
│   │   │   └── route.ts
│   │   ├── stop/
│   │   │   └── route.ts
│   │   └── route.ts (674 lines)
│   │   ├── scanner/
│   │   │   └── status/
│   │   │       └── route.ts
│   │   ├── settings/
│   │   │   └── route.ts
│   │   ├── shows/
│   │   │   ├── [id]/
│   │   │   │   ├── episodes/
│   │   │   │   │   ├── [episodeId]/
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   └── torrent/
│   │       ├── search/
│   │       │   └── route.ts
│   │       ├── test/
│   │       │   └── route.ts
│   │       └── route.ts
│   ├── components/
│   │   ├── EpisodesPerSeasonEditor.tsx (207 lines)
│   │   ├── LogViewer.tsx (375 lines)
│   │   ├── MagnetLinkHandler.tsx (140 lines)
│   │   ├── ScanController.tsx (120 lines)
│   │   ├── ShowDetail.tsx (461 lines)
│   │   ├── ShowForm.tsx (491 lines)
│   │   └── ShowsList.tsx (375 lines)
│   ├── hooks/
│   │   ├── useLogStream.ts (242 lines)
│   │   └── useScanState.ts (206 lines)
│   ├── settings/
│   │   └── page.tsx
│   ├── shows/
│   │   ├── [id]/
│   │   │   ├── edit/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   └── new/
│   │       └── page.tsx
│   ├── utils/
│   │   └── episodeCalculator.ts (102 lines)
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   │   ├── alert-dialog/
│   │   │   └── index.tsx
│   │   ├── alert.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── dialog.tsx
│   │   ├── header.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── scroll-area.tsx
│   │   ├── sonner.tsx
│   │   └── tabs.tsx
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
├── db/
│   ├── migrations/
│   │   ├── meta/
│   │   │   ├── 0000_snapshot.json
│   │   │   └── _journal.json
│   │   ├── 0000_tough_human_torch.sql
│   │   ├── 001_remove_episode_fields.sql
│   │   ├── add_episodes_per_season.js
│   │   ├── add_episodes_per_season.ts
│   │   ├── add_show_fields.ts
│   │   └── run-migrations.ts
│   ├── schema/
│   │   ├── episodes.ts
│   │   ├── index.ts
│   │   ├── logs.ts
│   │   ├── profiles.ts
│   │   ├── scanState.ts
│   │   ├── settings.ts
│   │   ├── shows.ts
│   │   └── todos.ts (unused)
│   └── db.ts
├── lib/
│   └── utils.ts
├── node_modules/
├── public/
│   └── vercel.svg
├── .env.local
├── .eslintrc.json
├── .gitignore
├── anime_tracker.py
├── components.json
├── drizzle.config.ts
├── next-env.d.ts
├── next.config.js
├── package-lock.json
├── package.json
├── postcss.config.js
├── project-steps.md
├── README.md
├── refactoring-plan.md
├── remove-fields.js
├── run-migration.js
├── server.js
├── tailwind.config.ts
└── tsconfig.json
```

## Refactoring Steps

### 1. Server Optimization

- [x] **Simplify Custom Server Implementation**
  - [x] Remove unnecessary garbage collection and memory monitoring in server.js
  - [x] Replace with standard Next.js server configuration
  - [x] Move any essential custom server logic to middleware or API routes
  - [x] Update package.json scripts to use standard Next.js commands

### 2. Code Structure Cleanup

- [x] **Consolidate Component Directories**

  - [x] Move theme-toggle.tsx and theme-provider.tsx from root components/ to app/components/ui/
  - [x] Move all UI components from components/ui/ to app/components/ui/
  - [x] Remove the root components/ directory
  - [x] Update imports across the codebase

- [x] **Normalize API Structure**
  - [x] Consolidate app/api/scan/ and app/api/scanner/ into a single directory
  - [x] Move app/api/scan/status/ and app/api/scanner/status/ into a single endpoint
  - [x] Refactor the large scan/route.ts (674 lines) into smaller, focused modules
  - [x] Create a shared API response format and error handling utility

### 3. Database and Migration Optimization

- [x] **Integrate Migration Scripts**
  - [x] Remove unused schema files (todos.ts)
  - [x] Consolidate migration files (add_episodes_per_season.js and add_episodes_per_season.ts)
  - [x] Move the functionality from remove-fields.js and run-migration.js into proper Drizzle migrations
  - [x] Create a standardized migration process using Drizzle's migration tools
  - [x] Remove standalone migration scripts
  - [x] Document the migration process in README.md

### 4. Frontend Simplification

- [x] **Refactor Large Components**

  - [x] Break down ShowDetail.tsx (461 lines) into smaller, focused components:
    - [x] Extract SeasonEpisodeList component
    - [x] Extract ShowHeader component
    - [x] Extract EpisodeItem component
    - [x] Extract ShowActions component
  - [x] Break down ShowForm.tsx (491 lines) into smaller, focused components:
    - [x] Extract FormFields component
    - [x] Extract ValidationLogic component
    - [x] Extract SubmitHandler component
  - [x] Break down LogViewer.tsx (375 lines) into smaller, focused components:
    - [x] Extract LogFilterControls component
    - [x] Extract LogEntry component
    - [x] Extract LogPagination component
  - [x] Break down ShowsList.tsx (375 lines) into smaller, focused components:
    - [x] Extract ShowListItem component
    - [x] Extract ShowListFilters component
    - [x] Extract ShowListPagination component
  - [x] Break down EpisodesPerSeasonEditor.tsx (207 lines) into smaller components:
    - [x] Extract EditorModal component
    - [x] Extract SeasonBreakdown component

- [x] **Implement Component Composition**
  - [x] Create reusable UI components for common patterns
  - [x] Implement proper component composition for complex UI elements
  - [x] Use React context where appropriate to avoid prop drilling

### 5. API Route Optimization

- [x] **Refactor Large API Routes**
  - [x] Break down scan/route.ts (674 lines) into smaller, focused modules:
    - [x] Create a separate module for scanning logic (scanShow, scanAllShows functions)
    - [x] Create a separate module for torrent parsing logic
    - [x] Create a separate module for episode calculation logic
    - [x] Create a separate module for logging functionality
  - [x] Implement proper error handling and logging
  - [x] Add request validation
  - [x] Consolidate duplicate API endpoints (torrent/search and torrent/test)

### 6. Utility Functions and Hooks

- [x] **Consolidate Utility Functions**

  - [x] Merge lib/utils.ts and app/utils/ into a single utils directory
  - [x] Create a standardized utility library
  - [x] Move episode calculation logic from API routes to utility functions
  - [x] Create shared validation utilities

- [x] **Optimize Custom Hooks**
  - [x] Refactor useLogStream.ts (242 lines) into smaller, focused hooks
  - [x] Refactor useScanState.ts (206 lines) into smaller, focused hooks
  - [x] Create custom hooks for show data fetching
  - [x] Create custom hooks for episode data fetching
  - [x] Create custom hooks for scan state management
  - [x] Document hook usage and purpose

### 7. Performance Optimization

- [x] **Implement Caching**

  - [x] Add proper caching for API responses
  - [x] Implement SWR for data fetching
  - [x] Optimize database queries with proper indexing

- [x] **Reduce Bundle Size**
  - [x] Analyze bundle size and identify large dependencies
  - [x] Implement code splitting for large components
  - [x] Lazy load components where appropriate

### 8. Code Quality and Standards

- [x] **Implement Consistent Coding Standards**

  - [x] Add ESLint rules for consistent code style
  - [x] Add Prettier configuration
  - [x] Ensure TypeScript types are used consistently

- [x] **Improve Error Handling**
  - [x] Create a centralized error handling utility
  - [x] Implement proper error logging
  - [x] Add user-friendly error messages

### 9. Documentation

- [ ] **Improve Code Documentation**
  - [ ] Add JSDoc comments to key functions and components
  - [ ] Update README with clear setup and usage instructions
  - [ ] Document API endpoints

## Specific Issues to Address

1. **Overly Complex Server Configuration**

   - server.js implements custom garbage collection and memory monitoring that is likely unnecessary for this application
   - The custom server adds complexity without clear benefits

2. **Duplicate Component Directories**

   - Components are split between app/components/ and root components/ without clear organization
   - Theme components in root directory while app components in app directory
   - UI components in components/ui/ should be moved to app/components/ui/

3. **Overlapping API Endpoints**

   - app/api/scan/ and app/api/scanner/ have overlapping functionality
   - app/api/scan/status/ and app/api/scanner/status/ likely serve similar purposes
   - app/api/torrent/ has multiple endpoints that could be consolidated

4. **Large, Monolithic Components**

   - ShowDetail.tsx (461 lines) handles show details, episode listing, season collapsing, and scanning
   - ShowForm.tsx (491 lines) handles form validation, submission, and UI rendering
   - LogViewer.tsx (375 lines) handles log filtering, pagination, and rendering
   - ShowsList.tsx (375 lines) handles show listing, filtering, and actions
   - EpisodesPerSeasonEditor.tsx (207 lines) handles complex form state

5. **Large API Route Files**

   - scan/route.ts (674 lines) contains scanning logic, torrent parsing, and episode calculation
   - Contains multiple responsibilities that should be separated

6. **Ad-hoc Migration Scripts**

   - remove-fields.js and run-migration.js are standalone scripts outside the standard migration process
   - Multiple migration files with similar functionality (add_episodes_per_season.js and add_episodes_per_season.ts)
   - No clear documentation on when or how to run these scripts

7. **Large Custom Hooks**

   - useLogStream.ts (242 lines) handles complex state management and event source connections
   - useScanState.ts (206 lines) handles complex state management and API calls

8. **Unused Schema Files**
   - todos.ts in the schema directory appears to be unused

## Implementation Details

### Component Refactoring Example: ShowDetail.tsx

Current structure:

```tsx
export function ShowDetail({ showId }: ShowDetailProps) {
  // State declarations (multiple states)
  // Data fetching logic
  // Episode grouping logic
  // Season expansion logic
  // Episode status toggle logic
  // Scan initiation logic
  // Episodes per season update logic
  // Render logic with complex conditionals
}
```

Proposed structure:

```tsx
// ShowHeader.tsx
export function ShowHeader({ show, onScan, onBack, loading }) {
  // Show header rendering with actions
}

// SeasonEpisodeList.tsx
export function SeasonEpisodeList({
  episodesBySeason,
  expandedSeasons,
  onToggleSeason,
  onToggleEpisode,
}) {
  // Season and episode list rendering
}

// EpisodeItem.tsx
export function EpisodeItem({ episode, onToggle, loading }) {
  // Individual episode rendering with toggle
}

// ShowDetail.tsx (main component)
export function ShowDetail({ showId }: ShowDetailProps) {
  // Core state and data fetching
  return (
    <div>
      <ShowHeader show={show} onScan={startSingleShowScan} onBack={handleBack} loading={loading} />
      <SeasonEpisodeList
        episodesBySeason={episodesBySeason}
        expandedSeasons={expandedSeasons}
        onToggleSeason={toggleSeasonCollapse}
        onToggleEpisode={toggleEpisodeStatus}
      />
    </div>
  );
}
```

### API Route Refactoring Example: scan/route.ts

Current structure:

```ts
// scan/route.ts
// Helper functions
async function createLog() { ... }

// API endpoints
export async function GET() { ... }
export async function POST() { ... }

// Scanning logic
async function scanShow() { ... }
async function scanAllShows() { ... }

// Episode calculation
function calculateAbsoluteEpisode() { ... }

// Title parsing
function truncateTitle() { ... }
```

Proposed structure:

```ts
// utils/logging.ts
export async function createLog() { ... }

// utils/episodeCalculator.ts
export function calculateAbsoluteEpisode() { ... }

// utils/titleParser.ts
export function truncateTitle() { ... }

// services/scanService.ts
export async function scanShow() { ... }
export async function scanAllShows() { ... }

// api/scan/route.ts
import { createLog } from '@/utils/logging';
import { scanShow, scanAllShows } from '@/services/scanService';

export async function GET() { ... }
export async function POST() { ... }
```

### Proposed Directory Structure After Refactoring

```
.
├── app/
│   ├── api/
│   │   ├── logs/
│   │   ├── scan/
│   │   ├── settings/
│   │   ├── shows/
│   │   └── torrent/
│   ├── components/
│   │   ├── episodes/
│   │   │   ├── EpisodeItem.tsx
│   │   │   ├── SeasonEpisodeList.tsx
│   │   │   └── EpisodesPerSeasonEditor.tsx
│   │   ├── logs/
│   │   │   ├── LogEntry.tsx
│   │   │   ├── LogFilterControls.tsx
│   │   │   ├── LogPagination.tsx
│   │   │   └── LogViewer.tsx
│   │   ├── scan/
│   │   │   ├── ScanController.tsx
│   │   │   └── MagnetLinkHandler.tsx
│   │   ├── shows/
│   │   │   ├── ShowHeader.tsx
│   │   │   ├── ShowActions.tsx
│   │   │   ├── ShowDetail.tsx
│   │   │   ├── ShowForm.tsx
│   │   │   ├── ShowListItem.tsx
│   │   │   ├── ShowListFilters.tsx
│   │   │   ├── ShowListPagination.tsx
│   │   │   └── ShowsList.tsx
│   │   └── ui/
│   │       ├── alert-dialog/
│   │       ├── alert.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── checkbox.tsx
│   │       ├── dialog.tsx
│   │       ├── header.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── scroll-area.tsx
│   │       ├── sonner.tsx
│   │       ├── tabs.tsx
│   │       ├── theme-provider.tsx
│   │       └── theme-toggle.tsx
│   ├── hooks/
│   │   ├── logs/
│   │   │   ├── useLogFilter.ts
│   │   │   └── useLogStream.ts
│   │   ├── scan/
│   │   │   └── useScanState.ts
│   │   └── shows/
│   │       ├── useShowData.ts
│   │       └── useEpisodeData.ts
│   ├── settings/
│   ├── shows/
│   └── utils/
│       ├── api/
│       │   └── responseHandler.ts
│       ├── episodeCalculator.ts
│       ├── logging.ts
│       ├── titleParser.ts
│       └── validation.ts
├── db/
│   ├── migrations/
│   │   ├── meta/
│   │   └── sql/
│   │       ├── 0000_initial_schema.sql
│   │       └── 0001_add_episodes_per_season.sql
│   ├── schema/
│   │   ├── episodes.ts
│   │   ├── index.ts
│   │   ├── logs.ts
│   │   ├── profiles.ts
│   │   ├── scanState.ts
│   │   ├── settings.ts
│   │   └── shows.ts
│   └── db.ts
├── lib/
│   └── services/
│       ├── scanService.ts
│       ├── torrentService.ts
│       └── logService.ts
├── public/
├── .env.local
├── .eslintrc.json
├── .gitignore
├── anime_tracker.py (reference only)
├── components.json
├── drizzle.config.ts
├── next-env.d.ts
├── next.config.js
├── package.json
├── postcss.config.js
├── README.md
├── tailwind.config.ts
└── tsconfig.json
```

## Progress Tracking

As changes are implemented, this section will track progress and update the file tree to reflect the current state of the project.

### Refactoring Progress

| Step                                   | Status      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Server Optimization                 | Completed   | Removed custom server.js with unnecessary GC and memory monitoring. Replaced with standard Next.js configuration and middleware. Updated package.json scripts.                                                                                                                                                                                                                                                                                                                                                                                              |
| 2. Code Structure Cleanup              | Completed   | Consolidated component directories and moved UI components to app/components/ui/. Created a consolidated scanner API structure. Refactored the large scan/route.ts file into smaller, focused modules and created shared API utilities.                                                                                                                                                                                                                                                                                                                     |
| 3. Database and Migration Optimization | Completed   | Removed unused todos.ts schema file. Consolidated migration files into SQL migrations in a standardized directory structure. Created a new migration runner using Drizzle. Removed standalone migration scripts. Updated documentation in README.md.                                                                                                                                                                                                                                                                                                        |
| 4. Frontend Simplification             | Completed   | Extracted components from ShowDetail.tsx (ShowHeader, EpisodeItem, SeasonEpisodeList, ShowActions), ShowForm.tsx (FormFields, ValidationLogic, SubmitHandler), LogViewer.tsx (LogFilterControls, LogEntry, LogPagination), ShowsList.tsx (ShowListItem, ShowListFilters, ShowListPagination), and EpisodesPerSeasonEditor.tsx (EditorModal, SeasonBreakdown). Created reusable UI components (LoadingState, EmptyState, SectionHeader, FormField, ShowCard) and implemented React contexts (ScanContext, ShowsContext, LogsContext) to avoid prop drilling. |
| 5. API Route Optimization              | Completed   | Refactored scan/route.ts (674 lines) into smaller, focused modules: scanService.ts for scanning logic, torrentParser.ts for torrent parsing, episodeCalculator.ts for episode calculation, and logging.ts for logging functionality. Implemented proper error handling with a responseHandler utility. Added request validation. Consolidated duplicate API endpoints (torrent/search and torrent/test) to use the same underlying service.                                                                                                                 |
| 6. Utility Functions and Hooks         | Completed   | Consolidated utility functions by moving them from app/utils to lib/utils with a standardized structure. Refactored useLogStream.ts into smaller hooks (useLogFetch, useLogFilter, useLogStream). Refactored useScanState.ts into smaller hooks (useScanStatus, useScanControl, useScanState). Created custom hooks for show data (useShowData) and episode data (useEpisodeData). Created proper type definitions and organized hooks by domain.                                                                                                           |
| 7. Performance Optimization            | Completed   | Added SWR for data fetching and caching with a global configuration. Created API response caching utilities with appropriate cache headers. Added database indexes for frequently queried fields. Implemented code splitting and lazy loading for large components.                                                                                                                                                                                                                                                                                         |
| 8. Code Quality and Standards          | Completed   | Added comprehensive ESLint rules for consistent code style. Added Prettier configuration for automatic code formatting. Created centralized error handling utilities with proper error types and user-friendly messages. Implemented client-side logging with configurable log levels. Added validation utilities for form data and API requests.                                                                                                                                                                                                           |
| 9. Documentation                       | Not Started |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Notes

- The original Python implementation (anime_tracker.py) should be kept as a reference but is not part of the active codebase.
- Focus on maintaining functionality while reducing complexity.
- Each refactoring step should be tested thoroughly before moving to the next.
