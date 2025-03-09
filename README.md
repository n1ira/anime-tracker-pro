# Anime Tracker Pro

A modern web application for tracking and automatically finding anime episodes. This project is a web-based reimagining of a Python-based anime tracking tool, built with Next.js, TypeScript, Tailwind CSS, and Supabase.

![Anime Tracker Pro](https://via.placeholder.com/800x400?text=Anime+Tracker+Pro)

## Features

- **Show Management**: Add, edit, and delete anime shows with customizable settings
- **Episode Tracking**: Track which episodes you've downloaded for each show
- **Automatic Scanning**: Scan for new episodes of your favorite shows
- **Real-time Updates**: Get live updates on scanning progress and results
- **Torrent Integration**: Automatically search for and open magnet links for new episodes
- **OpenAI Integration**: Use AI to parse torrent titles and identify the correct episodes
- **Responsive Design**: Modern UI that works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Drizzle ORM
- **Real-time Updates**: Server-Sent Events (SSE)
- **AI Integration**: OpenAI API for torrent title parsing

## Prerequisites

- Node.js 18.x or higher
- PostgreSQL database (or Supabase account)
- OpenAI API key (for torrent title parsing)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/anime-tracker-pro.git
   cd anime-tracker-pro
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following variables:

   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/anime_tracker
   OPENAI_API_KEY=your_openai_api_key (optional, can be set in the app)
   ```

4. Run the database migrations:

   ```bash
   npm run db:migrate
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Adding Shows

1. Click the "Add Show" button on the main page
2. Enter the show details:
   - **Title**: The name of the anime
   - **Alternate Names**: Other names the show might be known by (helps with searching)
   - **Start Season/Episode**: Where to start tracking
   - **End Season/Episode**: Where to stop tracking (leave empty for ongoing shows)
   - **Episodes Per Season**: Number of episodes in each season (can be a single number or a JSON array)
   - **Quality**: Preferred quality (e.g., 1080p, 720p)
   - **Status**: Ongoing, Completed, or Paused

### Scanning for Episodes

1. Use the Scan Controller to start scanning for new episodes
2. The system will search for episodes that you haven't downloaded yet
3. When a new episode is found, it will be marked as downloaded and a magnet link will be opened in your browser
4. Real-time logs will show the scanning progress and results

### Managing Episodes

1. Navigate to a show's detail page by clicking on it in the shows list
2. View all episodes organized by season
3. Toggle episodes as downloaded/not downloaded by clicking on them
4. Edit episode details by clicking the edit button

### Managing OpenAI API Key

1. Go to the Settings page
2. Enter your OpenAI API key or check the option to use the system environment variable
3. Save your settings

### Viewing Logs

1. Access the Logs page to see a history of application events
2. Filter logs by level (debug, info, warning, error)
3. View real-time logs during scanning operations

## Project Structure

The application follows a modular architecture with clear separation of concerns:

### Core Directories

- `/app`: Next.js app directory
  - `/api`: Backend API routes organized by domain
    - `/logs`: Log management endpoints
    - `/scan`: Scanning functionality endpoints
    - `/shows`: Show and episode management endpoints
    - `/torrent`: Torrent search and parsing endpoints
    - `/settings`: Application settings endpoints
  - `/components`: Frontend React components organized by domain
    - `/episodes`: Episode-related components
    - `/logs`: Log viewing components
    - `/scan`: Scanning control components
    - `/shows`: Show management components
    - `/ui`: Reusable UI components
  - `/hooks`: Custom React hooks organized by domain
    - `/logs`: Log-related hooks
    - `/scan`: Scan-related hooks
    - `/shows`: Show and episode data hooks
  - `/utils`: Utility functions
    - `/api`: API response handling utilities
    - `/episodeCalculator.ts`: Episode calculation utilities
    - `/logging.ts`: Logging utilities
    - `/titleParser.ts`: Torrent title parsing utilities
    - `/validation.ts`: Form validation utilities

- `/db`: Database schema and connection
  - `/schema`: Drizzle ORM schema definitions
  - `/migrations`: Database migrations
    - `/sql`: SQL migration files

- `/lib`: Utility libraries and services
  - `/services`: Business logic services
    - `/scanService.ts`: Scanning logic
    - `/torrentService.ts`: Torrent search and parsing
    - `/logService.ts`: Logging service
  - `/utils.ts`: General utility functions
  - `/swr-config.tsx`: SWR configuration for data fetching

### Key Files

- `middleware.ts`: Next.js middleware for request handling
- `next.config.js`: Next.js configuration
- `drizzle.config.ts`: Drizzle ORM configuration
- `tailwind.config.ts`: Tailwind CSS configuration
- `API.md`: API documentation

## Database Schema

The application uses the following database tables:

### Shows Table

Stores information about anime shows.

| Column             | Type    | Description                                |
|--------------------|---------|-------------------------------------------|
| id                 | Integer | Primary key                                |
| title              | String  | Show title                                 |
| alternateNames     | String  | Alternative titles for searching           |
| startSeason        | Integer | Starting season to track                   |
| startEpisode       | Integer | Starting episode to track                  |
| endSeason          | Integer | Ending season to track (null for ongoing)  |
| endEpisode         | Integer | Ending episode to track (null for ongoing) |
| episodesPerSeason  | String  | JSON string of episodes per season         |
| quality            | String  | Preferred quality (e.g., 1080p)            |
| status             | String  | Show status (ongoing, completed, paused)   |
| lastScanned        | String  | Timestamp of last scan                     |

### Episodes Table

Stores information about individual episodes.

| Column          | Type    | Description                                |
|-----------------|---------|-------------------------------------------|
| id              | Integer | Primary key                                |
| showId          | Integer | Foreign key to shows table                 |
| season          | Integer | Season number                              |
| episode         | Integer | Episode number within season               |
| absoluteEpisode | Integer | Absolute episode number across all seasons |
| downloaded      | Boolean | Whether the episode has been downloaded    |
| title           | String  | Episode title                              |
| torrentUrl      | String  | Magnet link for the episode                |

### Logs Table

Stores application logs.

| Column    | Type    | Description                                |
|-----------|---------|-------------------------------------------|
| id        | Integer | Primary key                                |
| timestamp | String  | ISO timestamp of the log                   |
| level     | String  | Log level (debug, info, warning, error)    |
| message   | String  | Log message                                |
| showId    | Integer | Related show ID (if applicable)            |
| origin    | String  | Origin of the log (scan, api, system, etc) |

### Scan State Table

Stores the current scan state.

| Column        | Type    | Description                                |
|---------------|---------|-------------------------------------------|
| id            | Integer | Primary key                                |
| isScanning    | Boolean | Whether a scan is in progress              |
| status        | String  | Current scan status                        |
| currentShowId | Integer | ID of the show currently being scanned     |

### Settings Table

Stores application settings.

| Column            | Type    | Description                                |
|-------------------|---------|-------------------------------------------|
| id                | Integer | Primary key                                |
| openaiApiKey      | String  | OpenAI API key                             |
| useSystemOpenaiKey| Boolean | Whether to use system environment variable |
| torrentSources    | String  | JSON array of torrent sources              |
| defaultQuality    | String  | Default quality for new shows              |

## API Documentation

For detailed API documentation, see [API.md](API.md).

## Development

### Running Migrations

The application uses Drizzle ORM for database migrations. The migration system has been simplified to use SQL files directly.

#### Migration Structure

- `/db/migrations/sql`: Contains all SQL migration files
  - `0000_initial_schema.sql`: Initial database schema
  - `0001_add_episodes_per_season.sql`: Adds episodes_per_season field
  - `0002_remove_episode_fields.sql`: Removes deprecated episode fields
  - `0003_add_show_fields.sql`: Adds additional show fields

#### Running Migrations

To run all migrations in sequence:

```bash
# Apply all migrations to the database
npm run db:run-migrations
```

#### Creating New Migrations

To create a new migration:

1. Create a new SQL file in the `/db/migrations/sql` directory with a sequential number prefix
2. Write your SQL migration statements in the file
3. Run the migrations using the command above

Example migration file:

```sql
-- Description of what this migration does
ALTER TABLE table_name ADD COLUMN new_column_name data_type;
```

### Code Style and Linting

The project uses ESLint and Prettier for code style and linting:

```bash
# Run ESLint
npm run lint

# Run Prettier
npm run format
```

### Testing

The project includes unit and integration tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Performance Considerations

The application includes several optimizations for performance and stability:

- **SWR for Data Fetching**: Uses SWR for efficient data fetching with caching and revalidation
- **API Response Caching**: Implements proper cache headers for API responses
- **Database Indexing**: Uses indexes on frequently queried fields
- **Code Splitting**: Implements code splitting for large components
- **Lazy Loading**: Lazy loads components where appropriate
- **Connection Pooling**: Uses database connection pooling for efficiency
- **Proper Cleanup**: Ensures proper cleanup of SSE connections to prevent memory leaks
- **Request Timeout Handling**: Implements timeout handling to prevent hanging requests

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Verify your DATABASE_URL in .env.local
   - Ensure PostgreSQL is running
   - Check network connectivity to Supabase (if using)

2. **OpenAI API Issues**
   - Verify your API key
   - Check usage limits on your OpenAI account
   - Ensure proper network connectivity

3. **Scanning Not Working**
   - Check logs for errors
   - Verify show information is correct
   - Ensure torrent sources are accessible

### Getting Help

If you encounter issues not covered here, please:
1. Check the logs for error messages
2. Review the API documentation
3. Open an issue on GitHub with detailed information about the problem

## License

[MIT](LICENSE)

## Acknowledgements

- This project is a web-based reimagining of a Python-based anime tracking tool
- UI components provided by [shadcn/ui](https://ui.shadcn.com/)
- Built with [Next.js](https://nextjs.org/), [Supabase](https://supabase.io/), and [Drizzle ORM](https://orm.drizzle.team/)
