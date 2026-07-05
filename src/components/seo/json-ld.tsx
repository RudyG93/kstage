// Données structurées schema.org injectées en <script type="application/ld+json">.
// Le CSP prod (script-src unsafe-inline) laisse passer les scripts inline.
// `<` échappé en < : neutralise toute injection </script> via la data.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
