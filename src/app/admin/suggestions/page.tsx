import { redirect } from 'next/navigation'
import { ModerationList } from '@/components/suggestions/moderation-list'
import { ArtistModerationList } from '@/components/suggestions/artist-moderation-list'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { getPendingSuggestions, getPendingArtistSuggestions } from '@/lib/suggestions/queries'

export const metadata = { title: 'Moderate suggestions' }

export default async function AdminSuggestionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) redirect('/')

  const [pending, artists] = await Promise.all([
    getPendingSuggestions(),
    getPendingArtistSuggestions(),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Moderate suggestions</h1>
          <p className="text-muted-foreground text-sm">
            {pending.length} event/fix · {artists.length} artist
          </p>
        </div>
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Events &amp; fixes</h2>
          <ModerationList suggestions={pending} />
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Artists</h2>
          <ArtistModerationList suggestions={artists} />
        </section>
      </div>
    </div>
  )
}
