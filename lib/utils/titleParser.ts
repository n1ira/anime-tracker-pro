/**
 * Truncate a title to a specified length
 * @param title The title to truncate
 * @param maxLength Maximum length of the truncated title
 * @returns Truncated title with ellipsis if needed
 */
export function truncateTitle(title: string, maxLength: number = 20): string {
  if (!title) return '';
  
  if (title.length <= maxLength) {
    return title;
  }
  
  return title.substring(0, maxLength - 3) + '...';
}

/**
 * Parse a title to extract season and episode information
 * @param title The title to parse
 * @returns Object containing season and episode if found, null otherwise
 */
export function parseTitle(title: string): { season: number; episode: number } | null {
  if (!title) return null;
  
  // Common patterns for season and episode in anime titles
  const patterns = [
    // S01E01 format
    /S(\d+)[Ee](\d+)/i,
    // Season 1 Episode 1 format
    /Season\s*(\d+)\s*Episode\s*(\d+)/i,
    // 1x01 format
    /(\d+)x(\d+)/i,
    // Episode 1 (for season 1 implied)
    /Episode\s*(\d+)/i,
    // E01 format (for season 1 implied)
    /E(\d+)/i,
    // #01 format (for season 1 implied)
    /#(\d+)/i,
    // - 01 format (for season 1 implied)
    /\s-\s(\d+)/i,
    // Ep 01 format (for season 1 implied)
    /Ep\s*(\d+)/i,
    // Ep.01 format (for season 1 implied)
    /Ep\.(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      if (match.length === 2) {
        // Only episode number found, assume season 1
        return { season: 1, episode: parseInt(match[1], 10) };
      } else if (match.length === 3) {
        // Both season and episode found
        return { 
          season: parseInt(match[1], 10), 
          episode: parseInt(match[2], 10) 
        };
      }
    }
  }
  
  return null;
} 