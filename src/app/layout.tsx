import type { Metadata, Viewport } from 'next'
import {
  Geist,
  Geist_Mono,
  Bricolage_Grotesque,
  Space_Grotesk,
  Instrument_Serif,
  Archivo,
} from 'next/font/google'
import Link from 'next/link'
import { BellIcon, SearchIcon } from 'lucide-react'
import { Toaster } from 'sonner'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { SiteNav } from '@/components/site-nav'
import { AuthMenu } from '@/components/auth/auth-menu'
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

// Thème (INTEGRATION.md §1) : Space Grotesk pour les chiffres (font-numeric),
// Instrument Serif pour l'accent du wordmark (font-serif). Les tokens @theme de
// globals.css pointent déjà vers ces variables.
const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

const instrument = Instrument_Serif({
  variable: '--font-instrument',
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
})

// Data Desk : Archivo variable (axe wdth) pour les labels condensés
// (.label-data / .label-data-inline dans globals.css — font-stretch 78-82%).
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  axes: ['wdth'],
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
  themeColor: '#0B0D12',
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

  // profile alimente l'avatar du header (entrée profil — Data Desk §6).
  const { data: profile } = user
    ? await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).maybeSingle()
    : { data: null }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${spaceGrotesk.variable} ${instrument.variable} ${archivo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {/* Header Data Desk (§7.1.1) : logo K + STAGE, recherche factice → /search,
              cloche → réglages notifs, avatar = entrée profil. Nav desktop inline ;
              sur mobile la nav vit dans la bottom-bar (SiteNav fixed). */}
          <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-3 md:px-4">
              <Link
                href="/"
                className="flex shrink-0 items-center gap-1.5 transition-opacity hover:opacity-80"
              >
                <span className="bg-primary text-primary-foreground font-heading flex size-[27px] items-center justify-center rounded-[8px] text-[14px] font-extrabold">
                  K
                </span>
                <span className="label-data-inline text-[12px] tracking-[0.22em]">Stage</span>
              </Link>
              <SiteNav variant="header" />
              {/* Champ recherche factice : simple lien stylé vers /search. */}
              <Link
                href="/search"
                className="bg-secondary text-muted-foreground hover:text-foreground flex h-[33px] min-w-0 flex-1 items-center gap-2 rounded-[8px] border px-3 text-xs transition-colors md:max-w-64"
              >
                <SearchIcon className="size-3.5 shrink-0" />
                <span className="truncate">Groups, MVs, events…</span>
              </Link>
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
              {user && (
                <Link
                  href="/account"
                  aria-label="Notification settings"
                  className="text-muted-foreground hover:text-foreground relative shrink-0 p-1 transition-colors"
                >
                  <BellIcon className="size-[18px]" />
                  <span
                    aria-hidden
                    className="bg-amber border-background absolute top-0.5 right-0.5 size-[7px] rounded-full border-2"
                  />
                </Link>
              )}
              <AuthMenu
                email={user?.email ?? null}
                username={profile?.username ?? null}
                avatarUrl={profile?.avatar_url ?? null}
              />
            </div>
          </header>
          <main className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-6">
            {children}
          </main>
          {/* Barre mobile hors du header : son backdrop-filter piégerait le fixed. */}
          <SiteNav variant="bottom" />
          <Footer />
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
