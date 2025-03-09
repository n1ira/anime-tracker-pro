# Anime Tracker Pro Refactoring Plan

This document outlines a plan to simplify and refactor the Anime Tracker Pro project, identifying areas where code can be removed, refactored, or restructured for better maintainability and performance.

## Current Project Structure

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
│   │   │   ├── status/
│   │   │   │   └── route.ts
│   │   │   ├── stop/
│   │   │   │   └── route.ts
│   │   │   └── route.ts (674 lines)
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

- [ ] **Refactor Large Components**
  - [ ] Break down ShowDetail.tsx (461 lines) into smaller, focused components:
    - [ ] Extract SeasonEpisodeList component
    - [ ] Extract ShowHeader component
    - [ ] Extract EpisodeItem component
    - [ ] Extract ShowActions component
  - [ ] Break down ShowForm.tsx (491 lines) into smaller, focused components:
    - [ ] Extract FormFields component
    - [ ] Extract ValidationLogic component
    - [ ] Extract SubmitHandler component
  - [ ] Break down LogViewer.tsx (375 lines) into smaller, focused components:
    - [ ] Extract LogFilterControls component
    - [ ] Extract LogEntry component
    - [ ] Extract LogPagination component
  - [ ] Break down ShowsList.tsx (375 lines) into smaller, focused components:
    - [ ] Extract ShowListItem component
    - [ ] Extract ShowListFilters component
    - [ ] Extract ShowListPagination component
  - [ ] Break down EpisodesPerSeasonEditor.tsx (207 lines) into smaller components

- [ ] **Implement Component Composition**
  - [ ] Create reusable UI components for common patterns
  - [ ] Implement proper component composition for complex UI elements
  - [ ] Use React context where appropriate to avoid prop drilling

### 5. API Route Optimization

- [ ] **Refactor Large API Routes**
  - [ ] Break down scan/route.ts (674 lines) into smaller, focused modules:
    - [ ] Create a separate module for scanning logic (scanShow, scanAllShows functions)
    - [ ] Create a separate module for torrent parsing logic
    - [ ] Create a separate module for episode calculation logic
    - [ ] Create a separate module for logging functionality
  - [ ] Implement proper error handling and logging
  - [ ] Add request validation
  - [ ] Consolidate duplicate API endpoints (torrent/search and torrent/test)

### 6. Utility Functions and Hooks

- [ ] **Consolidate Utility Functions**
  - [ ] Merge lib/utils.ts and app/utils/ into a single utils directory
  - [ ] Create a standardized utility library
  - [ ] Move episode calculation logic from API routes to utility functions
  - [ ] Create shared validation utilities

- [ ] **Optimize Custom Hooks**
  - [ ] Refactor useLogStream.ts (242 lines) into smaller, focused hooks
  - [ ] Refactor useScanState.ts (206 lines) into smaller, focused hooks
  - [ ] Create custom hooks for show data fetching
  - [ ] Create custom hooks for episode data fetching
  - [ ] Create custom hooks for scan state management
  - [ ] Document hook usage and purpose

### 7. Performance Optimization

- [ ] **Implement Caching**
  - [ ] Add proper caching for API responses
  - [ ] Implement SWR or React Query for data fetching
  - [ ] Optimize database queries with proper indexing

- [ ] **Reduce Bundle Size**
  - [ ] Analyze bundle size and identify large dependencies
  - [ ] Implement code splitting for large components
  - [ ] Lazy load components where appropriate

### 8. Code Quality and Standards

- [ ] **Implement Consistent Coding Standards**
  - [ ] Add ESLint rules for consistent code style
  - [ ] Add Prettier configuration
  - [ ] Ensure TypeScript types are used consistently

- [ ] **Improve Error Handling**
  - [ ] Create a centralized error handling utility
  - [ ] Implement proper error logging
  - [ ] Add user-friendly error messages

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
  onToggleEpisode 
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
      <ShowHeader 
        show={show} 
        onScan={startSingleShowScan} 
        onBack={handleBack}
        loading={loading} 
      />
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

| Step | Status | Notes |
|------|--------|-------|
| 1. Server Optimization | Completed | Removed custom server.js with unnecessary GC and memory monitoring. Replaced with standard Next.js configuration and middleware. Updated package.json scripts. |
| 2. Code Structure Cleanup | Completed | Consolidated component directories and moved UI components to app/components/ui/. Created a consolidated scanner API structure. Refactored the large scan/route.ts file into smaller, focused modules and created shared API utilities. |
| 3. Database and Migration Optimization | Completed | Removed unused todos.ts schema file. Consolidated migration files into SQL migrations in a standardized directory structure. Created a new migration runner using Drizzle. Removed standalone migration scripts. Updated documentation in README.md. |
| 4. Frontend Simplification | Not Started | |
| 5. API Route Optimization | Not Started | |
| 6. Utility Functions and Hooks | Not Started | |
| 7. Performance Optimization | Not Started | |
| 8. Code Quality and Standards | Not Started | |
| 9. Documentation | Not Started | |

## Notes

- The original Python implementation (anime_tracker.py) should be kept as a reference but is not part of the active codebase.
- Focus on maintaining functionality while reducing complexity.
- Each refactoring step should be tested thoroughly before moving to the next. 