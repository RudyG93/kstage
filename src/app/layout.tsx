import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Bricolage_Grotesque } from 'next/font/google'
import Link from 'next/link'
import { Toaster } from 'sonner'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { SiteNav } from '@/components/site-nav'
import { AuthMenu } from '@/components/auth/auth-menu'
import { SuggestEventDialog } from '@/components/suggestions/suggest-event-dialog'
import { Footer } from '@/components/footer'
import { Analytics } from '@vercel/analytics/next'
import { createClient } from '@/lib/supabase/server'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
})

const SITE_URL = 'https://kstage.vercel.app'
const SITE_DESCRIPTION = 'Your k-pop calendar — events, comebacks, and lives.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'KStage — your k-pop calendar', template: '%s · KStage' },
  description: SITE_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'KStage', statusBarStyle: 'black-translucent' },
  openGraph: {
    type: 'website',
    siteName: 'KStage',
    title: 'KStage — your k-pop calendar',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KStage — your k-pop calendar',
    description: SITE_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: '#0e0e13',
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

  const { data: profile } = user
    ? await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).maybeSingle()
    : { data: null }

  // Liste minimale (id, name) servie au Dialog Suggest si le user est connecté.
  // La liste complète d'events ciblables (Fix tab) est récupérée lazy via une
  // Route Handler côté composant pour éviter de payer 200 events sur chaque
  // page render.
  const { data: dialogGroups } = user
    ? await supabase.from('groups').select('id, name').order('name')
    : { data: null }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <header className="bg-background/95 sticky top-0 z-30 border-b">
            <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4">
              <Link
                href="/"
                className="font-heading text-lg font-extrabold tracking-tight transition-opacity hover:opacity-80"
              >
                <span className="bg-gradient-to-r from-[#8b5cff] to-[#ff2d87] bg-clip-text text-transparent">
                  KStage
                </span>
              </Link>
              <div className="flex-1" />
              <SiteNav />
              {user && dialogGroups && <SuggestEventDialog groups={dialogGroups} />}
              <AuthMenu
                email={user?.email ?? null}
                username={profile?.username ?? null}
                avatarUrl={profile?.avatar_url ?? null}
              />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 pb-24 md:pb-6">{children}</main>
          <Footer />
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
