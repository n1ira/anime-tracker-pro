import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Nyaa.si URL for anime torrents
const NYAA_URL = 'https://nyaa.si/';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || 'Solo Leveling S01E21';

    // Search nyaa.si
    const response = await axios.get(NYAA_URL, {
      params: {
        f: 0,
        c: '0_0',
        q: query,
        s: 'seeders',
        o: 'desc'
      },
      timeout: 10000
    });

    // Parse the HTML response
    const $ = cheerio.load(response.data);
    const results: Array<{ title: string; magnetLink: string }> = [];

    // Process each row in the results table
    $('tr.danger, tr.default, tr.success').each((_, row) => {
      const titleAnchor = $(row).find('a[href^="/view/"]:not(.comments)');
      if (!titleAnchor.length) return;

      const title = titleAnchor.text().trim();
      const magnetTag = $(row).find('a[href^="magnet:"]');
      if (!magnetTag.length) return;

      const magnetLink = magnetTag.attr('href') || '';
      
      results.push({
        title,
        magnetLink
      });
    });

    return NextResponse.json({
      query,
      results
    });
  } catch (error) {
    console.error('Error in torrent search test:', error);
    return NextResponse.json(
      { error: 'Failed to search for torrents' },
      { status: 500 }
    );
  }
} 