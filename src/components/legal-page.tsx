import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Gabarit partagé des pages légales (About / Terms / Privacy). Le styling des
// éléments enfants (h2, p, ul, a) est appliqué via des variantes arbitraires
// Tailwind — pas de plugin `prose` dans le projet.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated?: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {updated && <p className="text-muted-foreground mt-1 text-xs">Last updated: {updated}</p>}
      <div className="text-muted-foreground [&_h2]:text-foreground mt-6 space-y-4 text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  )
}
