import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/app/components/ui/theme-provider'
import { Header } from '@/app/components/ui/header'
import { Toaster } from '@/app/components/ui/sonner'
import { MagnetLinkHandler } from './components/MagnetLinkHandler'
import { ScanProvider } from './contexts/scan-context'
import { ShowsProvider } from './contexts/shows-context'
import { LogsProvider } from './contexts/logs-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Anime Tracker Pro',
  description: 'Track and manage your anime shows',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <ShowsProvider>
            <ScanProvider>
              <LogsProvider>
                <Header />
                <main className="flex-1 py-6">
                  {children}
                </main>
                <Toaster />
                <MagnetLinkHandler />
              </LogsProvider>
            </ScanProvider>
          </ShowsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
