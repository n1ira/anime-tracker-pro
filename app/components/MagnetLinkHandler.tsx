'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// This component listens for events from the server-sent events stream
// and opens magnet links automatically when new episodes are found
export function MagnetLinkHandler() {
  const [pendingMagnetLink, setPendingMagnetLink] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [episodeInfo, setEpisodeInfo] = useState<string>('');

  // Function to handle opening a magnet link
  const openMagnetLink = (magnetLink: string) => {
    // Try to open the magnet link directly
    const opened = window.open(magnetLink);
    
    // If window.open returns null or undefined, or browser blocks it
    if (!opened) {
      // Show dialog with the magnet link for manual copying
      setPendingMagnetLink(magnetLink);
      setShowDialog(true);
    }
  };

  // Function to copy magnet link to clipboard
  const copyToClipboard = () => {
    if (pendingMagnetLink) {
      navigator.clipboard.writeText(pendingMagnetLink)
        .then(() => {
          toast.success('Magnet link copied to clipboard');
        })
        .catch((err) => {
          console.error('Failed to copy: ', err);
          toast.error('Failed to copy magnet link');
        });
    }
  };

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
          setEpisodeInfo(`Episode ${episode}`);
          openMagnetLink(data.openMagnetLink);
          toast.success(`Found magnet link for episode ${episode}`);
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
  
  return (
    <>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Magnet Link for {episodeInfo}</DialogTitle>
            <DialogDescription>
              Your browser blocked the automatic opening of the magnet link. 
              You can copy the link below and paste it into your torrent client.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center space-x-2 mt-4">
            <Input 
              value={pendingMagnetLink || ''} 
              readOnly 
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button onClick={copyToClipboard}>Copy</Button>
          </div>
          
          <DialogFooter className="mt-4">
            <Button onClick={() => setShowDialog(false)}>Close</Button>
            <Button 
              variant="default" 
              onClick={() => {
                if (pendingMagnetLink) {
                  window.location.href = pendingMagnetLink;
                }
              }}
            >
              Try Opening Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 