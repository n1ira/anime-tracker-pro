# Anime Tracker Web App

## Project Description
Transform the existing Python anime tracker application into a modern web app using Next.js (with shadcn components), TypeScript, and Tailwind CSS. The app is intended for anime enthusiasts who prefer a web-based solution without user authentication. It will feature real-time torrent search and download initiation (via magnet links in the client's browser) along with live status updates and logging. The backend will expose an API (using Supabase with drizzle for the database) to manage tracked shows, logs, and scanning state. Users will also have a section to manage and store their OpenAI API key, with an option to pull the Windows system environment variable `OPENAI_API_KEY`.

## Step 1: Project Setup & Environment Configuration
- [x] Set up a Next.js project with shadcn, TypeScript, and Tailwind CSS.
- [x] Configure Supabase and drizzle for database integration.
- [x] Establish a clear project structure that separates frontend and backend API endpoints.

### Bug Check (Step 1)
- [x] Confirm that the project structure is correctly set up with designated folders for frontend and backend.
- [x] Verify that the Next.js development server runs without errors.
- [x] Use Windows CMD (e.g., with `curl`) to make a basic API call confirming Supabase connectivity.

## Step 2: Backend API Development - Core Data Models & Endpoints
- [x] Define database schemas for tracked shows, logs, and scanning state in Supabase using drizzle.
- [x] Implement API endpoints for CRUD operations on tracked shows.
- [x] Build initial endpoints for fetching and updating logs.

### Bug Check (Step 2)
- [x] Test API endpoints via Windows CMD (using tools like `curl`) to confirm expected responses.
- [x] Check that the Supabase tables are created and populated correctly.
- [x] Validate CRUD operations by creating, reading, updating, and deleting test entries.

## Step 3: Implement Core Torrent Search & Download Logic on Backend
- [x] Integrate the existing Python torrent search logic into the backend API.
- [x] Implement logic for constructing search queries, parsing torrent titles with OpenAI's API, and handling magnet links.
- [x] Ensure that torrent downloads trigger magnet links that open on the client's browser.

### Bug Check (Step 3)
- [x] Execute sample torrent search API calls via CMD to ensure the search queries and parsing work as expected.
- [x] Verify that the returned magnet links open correctly in the browser.
- [x] Confirm that sample titles sent to the OpenAI API are parsed correctly without errors.

## Step 4: Real-Time Scanning & Logging Functionality
- [x] Create API endpoints to start, stop, and monitor scans for a single show or all shows.
- [x] Develop a real-time logging mechanism to report scanning progress (e.g., "Started scanning for episode X of show Y", "Found/did not find episode X", etc.).
- [x] Integrate WebSocket or server-sent events to push real-time updates from the backend to the frontend.

### Bug Check (Step 4)
- [x] Manually test starting and stopping scans; ensure that real-time log messages are pushed to the frontend.
- [x] Validate that scanning can be cancelled at any time and that backend states update accurately.
- [x] Use CMD-based API calls to simulate and verify real-time log updates.

## Step 5: Frontend UI Development for Shows & Episodes Management
- [x] Develop a modern, responsive UI using shadcn components with Next.js, TypeScript, and Tailwind CSS.
- [x] Create interfaces for:
  - [x] Adding and editing anime shows.
  - [x] Displaying a list of tracked shows with a loading wheel indicator during scans.
  - [x] Viewing and toggling the status (Downloaded/Needed) of episodes for a selected show.
  - [x] Displaying real-time log updates.

### Bug Check (Step 5)
- [x] Verify that the UI loads correctly and is responsive on various devices.
- [x] Check that clicking on a show displays its episodes and that the statuses (Downloaded/Needed) are correct.
- [x] Confirm that clicking on an episode toggles its status and that the change is reflected via API calls.
- [x] Ensure that real-time log messages display properly on the UI.

## Step 6: OpenAI API Key Management Integration
- [x] Develop a UI section for users to enter and store their OpenAI API key.
- [x] Provide a checkbox option to automatically pull the Windows system environment variable `OPENAI_API_KEY`.
- [x] Ensure that the API key is securely stored and utilized in torrent title parsing API calls.
- [x] Make the torrent magnet links open automatically like in anime_tracker.py when a new episode is found and marked as downloaded

### Bug Check (Step 6)
- [x] Test the API key input section and verify the key is stored correctly in the database.
- [x] Check that selecting the checkbox pulls the API key from the Windows environment variable.
- [x] Validate that API calls using the stored API key function correctly without errors.

## Step 7: Final Integration, Testing & UI/UX Feedback
- [ ] Conduct thorough end-to-end testing of all features.

### Bug Check (Step 7)
- [ ] Confirm overall system stability and correct synchronization between frontend and backend components.
