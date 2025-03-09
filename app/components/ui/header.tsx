import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import { Cog } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container relative flex h-16 items-center">
        {/* Logo centered in the entire header */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Link href="/" className="pointer-events-auto">
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 text-transparent bg-clip-text hover:from-purple-500 hover:to-blue-400 transition-all">
              Anime Tracker
            </span>
          </Link>
        </div>
        
        {/* Settings and Theme toggle positioned at the right */}
        <div className="ml-auto flex items-center space-x-4">
          <Link 
            href="/settings" 
            className="p-2 hover:bg-accent rounded-md transition-colors"
            title="Settings"
          >
            <Cog className="h-5 w-5" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
} 