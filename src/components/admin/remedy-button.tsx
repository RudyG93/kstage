'use client'

import { useState, useTransition } from 'react'
import { triggerRemedyCron } from '@/app/admin/health/actions'
import type { TriggerableCron } from '@/lib/health/remedies'

/** Bouton 1-clic d'un remède /admin/health : déclenche le cron réparateur
    (after() côté serveur — le run continue après la réponse). */
export function RemedyButton({ cron, label }: { cron: TriggerableCron; label: string }) {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<'idle' | 'launched' | 'error'>('idle')

  return (
    <button
      type="button"
      disabled={pending || state === 'launched'}
      onClick={() =>
        startTransition(async () => {
          const res = await triggerRemedyCron(cron)
          setState('error' in res ? 'error' : 'launched')
        })
      }
      className="bg-secondary hover:bg-hover disabled:text-muted-foreground cursor-pointer rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-default"
    >
      {state === 'launched'
        ? 'Lancé ✓ (résultat dans scrape_log)'
        : state === 'error'
          ? 'Échec — réessayer'
          : pending
            ? 'Lancement…'
            : label}
    </button>
  )
}
