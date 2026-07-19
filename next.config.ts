import type { NextConfig } from 'next'

// CSP en enforce depuis 2026-07-04 (avant : report-only Phase 6).
// - `unsafe-eval` : dev uniquement (react-refresh/Turbopack) — ni React ni Next
//   n'utilisent eval en prod (doc Next 16 CSP).
// - `unsafe-inline` script-src conservé : les inline scripts RSC de Next
//   l'exigent sans nonces, et les nonces forceraient le rendu dynamique de
//   toutes les pages (tue static/ISR) — gated pré-ouverture publique (BACKLOG).
// - `unsafe-inline` style-src conservé : les attributs style="" de React/
//   next/image/Base UI ne sont pas couvrables par nonce (impasse connue).
// En dev le header reste report-only : l'outillage (HMR, overlays) ne doit
// jamais casser ; l'enforce ne concerne que build/prod.
const isDev = process.env.NODE_ENV === 'development'

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  // wss : Supabase Realtime (comments-realtime.tsx) — vu en enforce local,
  // silencieux du temps du report-only.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
  "media-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
  { key: isDev ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', value: CSP },
]

const nextConfig: NextConfig = {
  // Lot J : memoisation automatique des composants client (React Compiler,
  // stable v16) — remplace les useMemo/useCallback manuels ; SWC ne passe le
  // plugin Babel que sur les fichiers pertinents (JSX/hooks).
  reactCompiler: true,
  // Liens internes types (stable v16) : un href casse = erreur de compilation.
  typedRoutes: true,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
  images: {
    // v16 : defaut qualities=[75] — sans cette liste, le quality={70} du hero
    // (hero-backdrop.tsx) etait silencieusement force a 75.
    qualities: [70, 75],
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'kpopofficial.com' },
      { protocol: 'https', hostname: 'lgewrmrbksgtjmzzebhz.supabase.co' },
      { protocol: 'https', hostname: 'cdn-images.dzcdn.net' },
      { protocol: 'https', hostname: 'e-cdns-images.dzcdn.net' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'r2.theaudiodb.com' },
      { protocol: 'https', hostname: 'i.scdn.co' },
    ],
  },
}

export default nextConfig
