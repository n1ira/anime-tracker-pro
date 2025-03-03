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
   - Title: The name of the anime
   - Alternate Names: Other names the show might be known by
   - Start Season/Episode: Where to start tracking
   - End Season/Episode: Where to stop tracking
   - Episodes Per Season: Number of episodes in each season (can be a single number or a JSON array)
   - Quality: Preferred quality (e.g., 1080p, 720p)
   - Status: Ongoing, Completed, or Paused

### Scanning for Episodes

1. Use the Scan Controller to start scanning for new episodes
2. The system will search for episodes that you haven't downloaded yet
3. When a new episode is found, it will be marked as downloaded and a magnet link will be opened in your browser
4. Real-time logs will show the scanning progress and results

### Managing OpenAI API Key

1. Go to the Settings page
2. Enter your OpenAI API key or check the option to use the system environment variable
3. Save your settings

## Performance Optimizations

The application includes several optimizations for performance and stability:

- Adaptive garbage collection to manage memory usage
- Connection pooling for database efficiency
- Proper cleanup of SSE connections to prevent memory leaks
- Request timeout handling to prevent hanging requests
- Graceful shutdown procedures for both the server and database connections

## Development

### Project Structure

- `/app`: Next.js app directory
  - `/api`: Backend API routes
  - `/components`: Frontend React components
  - `/hooks`: Custom React hooks
  - `/utils`: Utility functions
- `/components`: Shared UI components (shadcn)
- `/db`: Database schema and connection
  - `/schema`: Drizzle ORM schema definitions
  - `/migrations`: Database migrations
- `/lib`: Utility libraries
- `/public`: Static assets

### Running Migrations

To create and run database migrations:

```bash
# Generate migrations based on schema changes
npm run db:generate

# Apply migrations to the database
npm run db:migrate
```

## License

[MIT](LICENSE)

## Acknowledgements

- This project is a web-based reimagining of a Python-based anime tracking tool
- UI components provided by [shadcn/ui](https://ui.shadcn.com/)
- Built with [Next.js](https://nextjs.org/), [Supabase](https://supabase.io/), and [Drizzle ORM](https://orm.drizzle.team/)
