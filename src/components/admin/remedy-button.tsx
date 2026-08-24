'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  getRemedyRunResult,
  minutesAvantRejeu,
  triggerRemedyCron,
} from '@/app/admin/health/actions'
import type { TriggerableCron } from '@/lib/health/remedies'

/**
 * Bouton 1-clic d'un remède /admin/health.
 *
 * Le run part en `after()` côté serveur (il peut durer des minutes), mais le
 * bouton NE SE CONTENTE PLUS d'annoncer « Lancé ✓ » : il interroge `scrape_log`
 * jusqu'à voir le run déclenché, puis affiche ce qu'il a réellement produit
 * (« 12 MV récupérés sur 4 groupes », « ⚠ quota YouTube épuisé »). Sans cette
 * boucle de retour, un remède sans effet était indiscernable d'un succès —
 * retour Rudy 2026-08-21 : « quoi que je fasse, ça ne change rien ».
 */
const POLL_MS = 5_000
const POLL_MAX_MS = 5 * 60_000

export function RemedyButton({ cron, label }: { cron: TriggerableCron; label: string }) {
  const [pending, startTransition] = useTransition()
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const since = useRef<string | null>(null)
  const stopAt = useRef<number>(0)
  // Délai restant AVANT le clic : « j'ai peur de cliquer sur des boutons
  // remède alors qu'il n'y en a pas besoin » (Rudy, 2026-08-24). Un bouton qui
  // dit lui-même qu'il ne servira à rien enlève la question.
  const [attenteMin, setAttenteMin] = useState<number | null>(null)

  useEffect(() => {
    let actif = true
    minutesAvantRejeu(cron).then((m) => {
      if (actif) setAttenteMin(m)
    })
    return () => {
      actif = false
    }
  }, [cron])

  // Poll tant qu'un run postérieur au clic n'est pas visible.
  useEffect(() => {
    if (phase !== 'running') return
    const timer = setInterval(async () => {
      if (Date.now() > stopAt.current) {
        clearInterval(timer)
        setPhase('done')
        setMessage('toujours en cours — voir « Derniers runs » plus bas')
        return
      }
      const res = await getRemedyRunResult(cron, since.current ?? new Date().toISOString())
      if (res.done) {
        clearInterval(timer)
        setPhase(res.status === 'error' ? 'error' : 'done')
        setMessage(res.summary ?? null)
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [phase, cron])

  const run = () =>
    startTransition(async () => {
      // Marge de 5 s : le run peut être loggué juste avant l'horloge cliente.
      since.current = new Date(Date.now() - 5_000).toISOString()
      stopAt.current = Date.now() + POLL_MAX_MS
      setMessage(null)
      const res = await triggerRemedyCron(cron)
      if ('error' in res) {
        setPhase('error')
        setMessage(res.error)
        void minutesAvantRejeu(cron).then(setAttenteMin)
        return
      }
      setAttenteMin(null)
      setPhase('running')
    })

  const enAttente = (attenteMin ?? 0) > 0 && phase === 'idle'
  const delai =
    attenteMin === null
      ? ''
      : attenteMin >= 60
        ? `${Math.ceil(attenteMin / 60)} h`
        : `${attenteMin} min`

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || phase === 'running' || enAttente}
        onClick={run}
        title={
          enAttente
            ? `Ce cron vient de tourner — le relancer maintenant ne produirait rien de neuf.`
            : undefined
        }
        className="bg-secondary hover:bg-hover disabled:text-muted-foreground cursor-pointer rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-default"
      >
        {phase === 'running'
          ? 'En cours…'
          : pending
            ? 'Lancement…'
            : enAttente
              ? `Déjà à jour · ${delai}`
              : label}
      </button>
      {message && (
        <span
          className={
            phase === 'error' ? 'text-xs font-medium text-red-500' : 'text-muted-foreground text-xs'
          }
        >
          {message}
        </span>
      )}
    </span>
  )
}
