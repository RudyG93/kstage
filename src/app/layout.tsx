import type { Metadata, Viewport } from 'next'
import {
  Geist,
  Geist_Mono,
  Bricolage_Grotesque,
  Space_Grotesk,
  Instrument_Serif,
} from 'next/font/google'
import localFont from 'next/font/local'
import { Suspense } from 'react'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site'
import { SearchIcon } from 'lucide-react'
import { Toaster } from 'sonner'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { SiteNav } from '@/components/site-nav'
import { HeaderSearch } from '@/components/search/header-search'
import { Footer } from '@/components/footer'
import { TimezoneCookie } from '@/components/timezone-cookie'
import { NotificationOpenTracker } from '@/components/analytics/notification-open-tracker'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { HeaderViewer } from '@/components/layout/header-viewer'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  // Precharge en NON (perf 2026-08-22) : 23 108 octets pousses en haute
  // priorite sur 100 % des pages publiques, alors que les deux seuls usages de
  // font-mono vivent dans /admin. Le @font-face reste emis : l'admin la charge
  // en lazy, en display swap, sur une page lue par une personne.
  preload: false,
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
  // Lot E CLS : famille d'accent (chiffres) — `optional` supprime tout layout
  // shift de swap (le fallback ajuste reste si la police n'arrive pas a temps).
  display: 'optional',
})

const instrument = Instrument_Serif({
  variable: '--font-instrument',
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  // Accent du wordmark uniquement : jamais critique → optional + pas de preload.
  display: 'optional',
  preload: false,
})

// Data Desk : Archivo variable (axe wdth) pour les labels condensés
// (.label-data / .label-data-inline dans globals.css — font-stretch 78-82%).
// Archivo VENDORISEE, graisse epinglee a 700 (perf 2026-08-22).
//
// Via next/font/google, la face latine pesait 90 096 octets — 44 % du budget
// polices de chaque page — parce que l'axe de GRAISSE etait servi en 100..900.
// L'API css2 n'instancie un sous-fichier que si un axe est fixe a une valeur
// unique ; pinner l'axe de largeur ne change rien (mesure : wdth@78..82 +
// wght@100..900 = 90 104 octets). Or next/font/google REFUSE `weight` des que
// `axes` est present (« Axes can only be defined for variable fonts when the
// weight property is nonexistent »), d'ou le passage en next/font/local sur
// `Archivo:wdth,wght@62..125,700` : 37 612 octets, axe de largeur INTACT.
//
// INVARIANT A TENIR : .label-data / .label-data-inline (globals.css) ne doivent
// jamais demander une autre graisse que 700 — l'axe wght n'existe plus dans ce
// fichier. L'axe wdth reste entier (62..125), donc font-stretch reste libre.
// Fichier sous OFL, licence jointe (src/app/fonts/OFL.txt).
const archivo = localFont({
  src: './fonts/archivo-cond-700-latin.woff2',
  variable: '--font-archivo',
  weight: '700',
  style: 'normal',
  // Le sous-ensemble vendorise est le LATIN seul : ces labels sont du chrome
  // d'interface (« NEXT UP », « COMEBACK »). Declarer la plage evite que le
  // navigateur tente d'y puiser un glyphe absent au lieu de replier.
  declarations: [
    { prop: 'font-stretch', value: '62% 125%' },
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
  // Metriques de repli calculees depuis le fichier : sans elles on
  // reintroduirait le CLS que next/font/google evitait.
  adjustFontFallback: 'Arial',
  // Labels condenses (.label-data) : optional — zero shift de swap.
  display: 'optional',
})

const SITE_DESCRIPTION =
  'Your k-pop calendar — releases, music videos, music shows, birthdays, and debut anniversaries.'

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

// Lot F (2026-07-18) : layout SYNCHRONE — l'auth vit dans <HeaderViewer/>
// (Suspense). Le shell (header/nav/footer) ne depend plus d'aucune donnee :
// forme requise par le futur shell cache (cacheComponents, Lot I).
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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
          {/* Skip-link (WCAG 2.4.1) : premier focus de la page — le clavier
              saute header + nav vers le contenu. Visible seulement au focus. */}
          <a
            href="#main"
            className="focus:bg-primary focus:text-primary-foreground sr-only z-50 rounded-md focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
          >
            Skip to content
          </a>
          <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
            {/* Grid 3 zones (gauche/centre/droite) : la recherche est centrée au
                lieu de pousser les groupes avec un flex-1 déséquilibré. */}
            <div className="mx-auto grid h-14 w-full max-w-[1400px] grid-cols-[auto_1fr_auto] items-center gap-3 px-3 md:px-4">
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="flex shrink-0 items-center gap-1.5 transition-opacity hover:opacity-80"
                >
                  <span className="bg-primary text-primary-foreground font-heading flex size-[27px] items-center justify-center rounded-md text-[14px] font-extrabold">
                    K
                  </span>
                  {/* Wordmark masqué sur très petits écrans : il comprimait la
                      recherche du header visiteur (audit §8.5). */}
                  <span className="label-data-inline hidden text-[12px] tracking-[0.22em] min-[380px]:inline">
                    Stage
                  </span>
                </Link>
                <SiteNav variant="header" />
              </div>
              <div className="flex min-w-0 justify-center">
                {/* Desktop : recherche live avec dropdown. Mobile : lien /search
                    (clavier virtuel + place — la vraie recherche vit sur la page). */}
                <div className="hidden w-full max-w-md md:block">
                  <HeaderSearch />
                </div>
                <Link
                  href="/search"
                  className="bg-secondary text-muted-foreground hover:text-foreground flex h-9 w-full min-w-0 items-center gap-2 rounded-md border px-3 text-sm transition-colors md:hidden"
                >
                  <SearchIcon className="size-4 shrink-0" />
                  <span className="truncate">Groups, MVs, events…</span>
                </Link>
              </div>
              <div className="flex items-center gap-2">
                {/* Visible aussi en mobile depuis R4-G : le bloc Settings du
                    profil (ex-seul accès mobile au thème) est supprimé. */}
                <ThemeToggle />
                {/* Lot F : le seul morceau viewer-dependant du shell — async
                    sous Suspense, le reste du header ne l'attend plus. */}
                <Suspense fallback={<span className="inline-block size-8" aria-hidden />}>
                  <HeaderViewer />
                </Suspense>
              </div>
            </div>
          </header>
          <main
            id="main"
            tabIndex={-1}
            className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none md:pb-6"
          >
            {children}
          </main>
          {/* Barre mobile hors du header : son backdrop-filter piégerait le fixed. */}
          <SiteNav variant="bottom" />
          <Footer />
          <Toaster position="bottom-right" richColors closeButton />
          <TimezoneCookie />
          {/* Attribution des ouvertures de push (`?src=push`, audit §10.3). */}
          <NotificationOpenTracker />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
