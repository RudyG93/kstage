import { redirect } from 'next/navigation'
import { SuggestionForm } from '@/components/suggestions/suggestion-form'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Suggest an event' }

export default async function SuggestPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: groups } = await supabase.from('groups').select('id, name').order('name')

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Suggest an event</h1>
          <p className="text-muted-foreground text-sm">
            Spotted an MV, release, music show or concert we&apos;re missing? Submit it — a
            moderator will review it before it appears on the calendar.
          </p>
        </div>
        <SuggestionForm groups={groups ?? []} />
      </div>
    </div>
  )
}
