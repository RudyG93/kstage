import { createClient } from '@/lib/supabase/server'
import { requireAdminPage } from '@/lib/auth/require-admin'
import { EventAdminList, type AdminEvent } from '@/components/admin/event-admin-list'

export const metadata = { title: 'Events' }

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireAdminPage()
  const supabase = await createClient()

  const { q } = await searchParams
  const query = (q ?? '').trim()
  let events: AdminEvent[] = []
  if (query.length >= 2) {
    const { data } = await supabase
      .from('events')
      .select('id, title, type, start_at, hidden, groups!inner(name)')
      .ilike('title', `%${query}%`)
      .order('start_at', { ascending: false })
      .limit(50)
    events = (data ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      start_at: e.start_at,
      hidden: e.hidden,
      group: e.groups.name,
    }))
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Events</h1>
        <p className="text-muted-foreground text-sm">
          Corrige un titre, ou masque un faux event (mis-scrapé) sans le supprimer — il disparaît du
          calendrier / des grilles MV.
        </p>
      </div>
      <form method="get" className="mt-6">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Rechercher un titre d’event…"
          className="border-input bg-background focus-visible:ring-ring/50 h-10 w-full rounded-lg border px-3 text-base outline-none focus-visible:ring-2 md:text-sm"
        />
      </form>
      <div className="mt-4">
        {query.length < 2 ? (
          <p className="text-muted-foreground px-1 py-3 text-sm">Tape au moins 2 caractères.</p>
        ) : (
          <EventAdminList events={events} />
        )}
      </div>
    </div>
  )
}
