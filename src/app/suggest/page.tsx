import { redirect } from 'next/navigation'
import { SuggestEventDialog } from '@/components/suggestions/suggest-event-dialog'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Suggest an event' }

/**
 * Page fallback : un lien direct vers `/suggest` ouvre la modal automatiquement
 * sur la home. Reste utile pour partager une URL profonde ("contribute to
 * KStage → https://kstage.vercel.app/suggest").
 */
export default async function SuggestPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: groups } = await supabase.from('groups').select('id, name').order('name')

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Suggest an event</h1>
        <p className="text-muted-foreground text-sm">
          Submit a new event or fix an existing one. A moderator reviews before it appears.
        </p>
        <div className="flex justify-center">
          <SuggestEventDialog
            groups={groups ?? []}
            defaultOpen
            triggerLabel="Open the suggestion form"
          />
        </div>
      </div>
    </div>
  )
}
