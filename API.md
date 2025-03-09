# Anime Tracker Pro API Documentation

This document provides detailed information about the API endpoints available in the Anime Tracker Pro application.

## Table of Contents

- [Shows](#shows)
  - [Get All Shows](#get-all-shows)
  - [Create Show](#create-show)
  - [Get Show](#get-show)
  - [Update Show](#update-show)
  - [Delete Show](#delete-show)
  - [Get Show Episodes](#get-show-episodes)
  - [Update Episode](#update-episode)
- [Scanning](#scanning)
  - [Get Scan Status](#get-scan-status)
  - [Start Scan](#start-scan)
  - [Stop Scan](#stop-scan)
  - [Scan Events](#scan-events)
- [Torrents](#torrents)
  - [Search Torrents](#search-torrents)
  - [Test Torrent](#test-torrent)
- [Logs](#logs)
  - [Get Logs](#get-logs)
  - [Log Stream](#log-stream)
- [Settings](#settings)
  - [Get Settings](#get-settings)
  - [Update Settings](#update-settings)

## Shows

### Get All Shows

Retrieves a list of all anime shows in the database.

**URL**: `/api/shows`

**Method**: `GET`

**Response**:
```json
[
  {
    "id": 1,
    "title": "My Hero Academia",
    "alternateNames": "Boku no Hero Academia",
    "startSeason": 1,
    "startEpisode": 1,
    "endSeason": null,
    "endEpisode": null,
    "episodesPerSeason": "[25, 25, 25, 25, 25]",
    "quality": "1080p",
    "status": "ongoing",
    "lastScanned": "2023-03-01T12:00:00Z"
  }
]
```

### Create Show

Creates a new anime show in the database.

**URL**: `/api/shows`

**Method**: `POST`

**Request Body**:
```json
{
  "title": "My Hero Academia",
  "alternateNames": "Boku no Hero Academia",
  "startSeason": 1,
  "startEpisode": 1,
  "endSeason": null,
  "endEpisode": null,
  "episodesPerSeason": "[25, 25, 25, 25, 25]",
  "quality": "1080p",
  "status": "ongoing"
}
```

**Response**:
```json
{
  "id": 1,
  "title": "My Hero Academia",
  "alternateNames": "Boku no Hero Academia",
  "startSeason": 1,
  "startEpisode": 1,
  "endSeason": null,
  "endEpisode": null,
  "episodesPerSeason": "[25, 25, 25, 25, 25]",
  "quality": "1080p",
  "status": "ongoing",
  "lastScanned": null
}
```

### Get Show

Retrieves a specific show by ID.

**URL**: `/api/shows/[id]`

**Method**: `GET`

**URL Parameters**:
- `id`: The ID of the show to retrieve

**Response**:
```json
{
  "id": 1,
  "title": "My Hero Academia",
  "alternateNames": "Boku no Hero Academia",
  "startSeason": 1,
  "startEpisode": 1,
  "endSeason": null,
  "endEpisode": null,
  "episodesPerSeason": "[25, 25, 25, 25, 25]",
  "quality": "1080p",
  "status": "ongoing",
  "lastScanned": "2023-03-01T12:00:00Z"
}
```

### Update Show

Updates an existing show.

**URL**: `/api/shows/[id]`

**Method**: `PUT`

**URL Parameters**:
- `id`: The ID of the show to update

**Request Body**:
```json
{
  "title": "My Hero Academia",
  "alternateNames": "Boku no Hero Academia",
  "startSeason": 1,
  "startEpisode": 1,
  "endSeason": 6,
  "endEpisode": 25,
  "episodesPerSeason": "[25, 25, 25, 25, 25, 25]",
  "quality": "1080p",
  "status": "completed"
}
```

**Response**:
```json
{
  "id": 1,
  "title": "My Hero Academia",
  "alternateNames": "Boku no Hero Academia",
  "startSeason": 1,
  "startEpisode": 1,
  "endSeason": 6,
  "endEpisode": 25,
  "episodesPerSeason": "[25, 25, 25, 25, 25, 25]",
  "quality": "1080p",
  "status": "completed",
  "lastScanned": "2023-03-01T12:00:00Z"
}
```

### Delete Show

Deletes a show and all its episodes.

**URL**: `/api/shows/[id]`

**Method**: `DELETE`

**URL Parameters**:
- `id`: The ID of the show to delete

**Response**:
```json
{
  "success": true
}
```

### Get Show Episodes

Retrieves all episodes for a specific show.

**URL**: `/api/shows/[id]/episodes`

**Method**: `GET`

**URL Parameters**:
- `id`: The ID of the show to retrieve episodes for

**Response**:
```json
[
  {
    "id": 1,
    "showId": 1,
    "season": 1,
    "episode": 1,
    "absoluteEpisode": 1,
    "downloaded": true,
    "title": "Izuku Midoriya: Origin",
    "torrentUrl": "magnet:?xt=urn:btih:..."
  }
]
```

### Update Episode

Updates the status of a specific episode.

**URL**: `/api/shows/[id]/episodes/[episodeId]`

**Method**: `PUT`

**URL Parameters**:
- `id`: The ID of the show
- `episodeId`: The ID of the episode to update

**Request Body**:
```json
{
  "downloaded": true,
  "title": "Izuku Midoriya: Origin",
  "torrentUrl": "magnet:?xt=urn:btih:..."
}
```

**Response**:
```json
{
  "id": 1,
  "showId": 1,
  "season": 1,
  "episode": 1,
  "absoluteEpisode": 1,
  "downloaded": true,
  "title": "Izuku Midoriya: Origin",
  "torrentUrl": "magnet:?xt=urn:btih:..."
}
```

## Scanning

### Get Scan Status

Retrieves the current scan status.

**URL**: `/api/scan/status`

**Method**: `GET`

**Response**:
```json
{
  "isScanning": false,
  "status": "idle",
  "currentShowId": null
}
```

### Start Scan

Starts a scan for new episodes.

**URL**: `/api/scan`

**Method**: `POST`

**Request Body**:
```json
{
  "showId": 1,
  "scanAll": false
}
```

**Response**:
```json
{
  "success": true,
  "message": "Scan started"
}
```

### Stop Scan

Stops an ongoing scan.

**URL**: `/api/stop`

**Method**: `POST`

**Response**:
```json
{
  "success": true,
  "message": "Scan stopped"
}
```

### Scan Events

Stream of events for an ongoing scan.

**URL**: `/api/scan/events`

**Method**: `GET`

**Response**: Server-Sent Events (SSE) stream

## Torrents

### Search Torrents

Searches for torrents matching the given query.

**URL**: `/api/torrent/search`

**Method**: `POST`

**Request Body**:
```json
{
  "query": "My Hero Academia S01E01 1080p",
  "showId": 1,
  "season": 1,
  "episode": 1
}
```

**Response**:
```json
{
  "results": [
    {
      "title": "[SubsPlease] My Hero Academia S01E01 (1080p)",
      "url": "magnet:?xt=urn:btih:...",
      "size": "1.2 GB",
      "seeders": 100,
      "leechers": 10,
      "source": "nyaa"
    }
  ]
}
```

### Test Torrent

Tests parsing a torrent title to extract season and episode information.

**URL**: `/api/torrent/test`

**Method**: `POST`

**Request Body**:
```json
{
  "title": "[SubsPlease] My Hero Academia S01E01 (1080p)"
}
```

**Response**:
```json
{
  "season": 1,
  "episode": 1,
  "quality": "1080p",
  "group": "SubsPlease",
  "title": "My Hero Academia"
}
```

## Logs

### Get Logs

Retrieves logs from the database.

**URL**: `/api/logs`

**Method**: `GET`

**Query Parameters**:
- `level`: Filter by log level (debug, info, warning, error)
- `limit`: Number of logs to return (default: 100)
- `offset`: Offset for pagination (default: 0)

**Response**:
```json
{
  "logs": [
    {
      "id": 1,
      "timestamp": "2023-03-01T12:00:00Z",
      "level": "info",
      "message": "Scan started for show: My Hero Academia",
      "showId": 1,
      "origin": "scan"
    }
  ],
  "total": 1
}
```

### Log Stream

Stream of logs in real-time.

**URL**: `/api/logs/sse`

**Method**: `GET`

**Response**: Server-Sent Events (SSE) stream

## Settings

### Get Settings

Retrieves the application settings.

**URL**: `/api/settings`

**Method**: `GET`

**Response**:
```json
{
  "openaiApiKey": "sk-...",
  "useSystemOpenaiKey": false,
  "torrentSources": ["nyaa", "animetosho"],
  "defaultQuality": "1080p"
}
```

### Update Settings

Updates the application settings.

**URL**: `/api/settings`

**Method**: `PUT`

**Request Body**:
```json
{
  "openaiApiKey": "sk-...",
  "useSystemOpenaiKey": false,
  "torrentSources": ["nyaa", "animetosho"],
  "defaultQuality": "1080p"
}
```

**Response**:
```json
{
  "success": true,
  "settings": {
    "openaiApiKey": "sk-...",
    "useSystemOpenaiKey": false,
    "torrentSources": ["nyaa", "animetosho"],
    "defaultQuality": "1080p"
  }
}
``` 