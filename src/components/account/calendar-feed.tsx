'use client'

import { useTransition } from 'react'
import { CalendarPlus, Copy, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { enableCalendarFeed, regenerateCalendarFeedToken } from '@/lib/ical/actions'

/**
 * Feed iCal perso (R3) : abonnement Google/Apple Calendar par URL token.
 * V1 free intégral — un feed « mes groupes suivis » ; les feeds filtrés
 * multi-calendriers sont l'idée premium (BACKLOG).
 */
export function CalendarFeed({ feedUrl }: { feedUrl: string | null }) {
  const [pending, startTransition] = useTransition()

  function enable() {
    startTransition(async () => {
      try {
        await enableCalendarFeed()
      } catch {
        toast.error('Could not enable the calendar feed. Please try again.')
      }
    })
  }

  function regenerate() {
    // Irréversible pour les calendriers déjà abonnés (l'ancien token meurt,
    // la sync s'arrête sans erreur visible côté Google/Apple) → confirmation.
    if (
      !window.confirm(
        'Reset the feed URL? Calendars subscribed to the old URL will stop syncing until you re-subscribe with the new one.',
      )
    )
      return
    startTransition(async () => {
      try {
        await regenerateCalendarFeedToken()
        toast.success('New URL generated — the old one no longer works.')
      } catch {
        toast.error('Could not reset the URL. Please try again.')
      }
    })
  }

  async function copy() {
    if (!feedUrl) return
    try {
      await navigator.clipboard.writeText(feedUrl)
      toast.success('Feed URL copied')
    } catch {
      toast.error('Could not copy — select the URL manually.')
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Calendar feed</p>
          <p className="text-muted-foreground text-sm">
            Subscribe from Google or Apple Calendar — your groups&apos; events, always in sync.
          </p>
        </div>
        {!feedUrl && (
          <Button
            type="button"
            size="sm"
            onClick={enable}
            disabled={pending}
            // Nom accessible distinct : PushToggle a déjà un bouton « Enable »
            // dans la même section.
            aria-label="Enable calendar feed"
          >
            <CalendarPlus aria-hidden />
            {pending ? 'Enabling…' : 'Enable'}
          </Button>
        )}
      </div>

      {feedUrl && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={feedUrl}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Calendar feed URL"
              className="bg-secondary text-muted-foreground focus-visible:ring-ring/50 w-full truncate rounded-md border px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={copy}
              aria-label="Copy feed URL"
            >
              <Copy aria-hidden />
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Google Calendar: Settings → Add calendar → From URL. Apple Calendar: File → New Calendar
            Subscription.
          </p>
          <button
            type="button"
            onClick={regenerate}
            disabled={pending}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline underline-offset-4"
          >
            <RefreshCw className="size-3" aria-hidden />
            Reset URL (if it leaked)
          </button>
        </div>
      )}
    </div>
  )
}
