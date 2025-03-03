'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

// This component listens for events from the server-sent events stream
// and opens magnet links automatically when new episodes are found
export function MagnetLinkHandler() {
  useEffect(() => {
    // Function to handle torrent search responses
    const handleTorrentSearch = async (showId: number, season: number, episode: number) => {
      try {
        const response = await fetch('/api/torrent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ showId, season, episode }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to search for torrents');
        }
        
        const data = await response.json();
        
        // If a magnet link should be opened, open it
        if (data.openMagnetLink) {
          // Open the magnet link in a new tab
          window.open(data.openMagnetLink, '_blank');
          
          toast.success(`Found and opened magnet link for episode ${episode}`);
        }
      } catch (error) {
        console.error('Error searching for torrents:', error);
        toast.error('Failed to search for torrents');
      }
    };
    
    // Listen for scan events from the server
    const eventSource = new EventSource('/api/scan/events');
    
    eventSource.addEventListener('episodeFound', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.showId && data.season !== undefined && data.episode !== undefined) {
          handleTorrentSearch(data.showId, data.season, data.episode);
        }
      } catch (error) {
        console.error('Error parsing episode found event:', error);
      }
    });
    
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      eventSource.close();
      
      // Try to reconnect after a delay
      setTimeout(() => {
        // This component will be remounted, which will create a new EventSource
      }, 5000);
    };
    
    return () => {
      eventSource.close();
    };
  }, []);
  
  // This component doesn't render anything
  return null;
} 