'use client'

/**
 * Dernier filet : une exception levée dans le ROOT LAYOUT (ou dans le
 * ThemeProvider qu'il monte) se produit AU-DESSUS de `error.tsx`, qui vit
 * sous ce layout. Sans ce fichier, Next sert son écran d'erreur brut — non
 * stylé, sans police, sans lien de retour, sur n'importe quelle page du site.
 *
 * Il remplace tout le document : il doit donc porter ses propres `<html>` et
 * `<body>`, et il rend HORS du ThemeProvider — d'où le `class="dark"` en dur,
 * qui est le `defaultTheme` de l'app (`enableSystem={false}`). Les variables
 * de police ne sont pas disponibles ici : on s'appuie sur les piles système.
 *
 * Styles inline volontaires : une erreur au niveau racine peut très bien être
 * la feuille de styles elle-même qui n'a pas chargé.
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string }
  /** `retry` (pas `reset`) : `reset` se contente de vider l'état du boundary,
      donc il rejoue le MÊME arbre serveur cassé. `retry` rafraîchit d'abord
      l'arbre (`router.refresh()`) puis réinitialise — c'est la seule des deux
      props qui peut récupérer une erreur venue du rendu serveur, et c'est
      celle de l'exemple officiel Next 16. */
  retry: () => void
}) {
  return (
    <html lang="en" className="dark">
      {/* `metadata`/`generateMetadata` ne sont pas supportés dans
          global-error (c'est un Client Component qui remplace le document) :
          le composant React <title> est l'alternative documentée. Sans lui la
          page d'erreur racine n'a aucun titre — WCAG 2.4.2. */}
      <title>Something went wrong — KStage</title>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '2rem',
          textAlign: 'center',
          background: '#09090b',
          color: '#fafafa',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: '#a1a1aa',
          }}
        >
          Error
        </p>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Something went wrong
        </h1>
        <p style={{ margin: 0, maxWidth: '28rem', fontSize: '0.875rem', color: '#a1a1aa' }}>
          KStage failed to load. It&apos;s on us — try again, or head back to the calendar.
        </p>
        <div
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <button
            type="button"
            onClick={retry}
            style={{
              cursor: 'pointer',
              borderRadius: '0.5rem',
              border: 0,
              padding: '0.6rem 1.1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: '#fafafa',
              color: '#09090b',
            }}
          >
            Try again
          </button>
          {/* Navigation DURE volontaire (pas next/link) : on arrive ici parce
              que l'arbre React racine est tombé — un routage client repartirait
              du même arbre cassé. Un rechargement complet est le seul retour
              fiable. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              borderRadius: '0.5rem',
              border: '1px solid #27272a',
              padding: '0.6rem 1.1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#fafafa',
              textDecoration: 'none',
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  )
}
