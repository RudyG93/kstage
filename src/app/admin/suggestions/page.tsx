import { redirect } from 'next/navigation'
import { ModerationList } from '@/components/suggestions/moderation-list'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { getPendingSuggestions } from '@/lib/suggestions/queries'

export const metadata = { title: 'Moderate suggestions' }

export default async function AdminSuggestionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) redirect('/')

  const pending = await getPendingSuggestions()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Moderate suggestions</h1>
        <p className="text-muted-foreground text-sm">{pending.length} pending</p>
      </div>
      <ModerationList suggestions={pending} />
    </div>
  )
}
