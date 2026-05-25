import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { SiteNav } from '@/components/site-nav'
import { AuthMenu } from '@/components/auth/auth-menu'
import { createClient } from '@/lib/supabase/server'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: { default: 'KStage', template: '%s · KStage' },
  description: 'Your k-pop calendar — events, comebacks, and lives.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'KStage', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center gap-4 border-b px-4">
            <Link href="/" className="text-lg font-bold tracking-tight">
              KStage
            </Link>
            <div className="flex-1" />
            <SiteNav isAuthed={!!user} />
            <AuthMenu email={user?.email ?? null} />
            <ThemeToggle />
          </header>
          <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-24 md:pb-6">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
