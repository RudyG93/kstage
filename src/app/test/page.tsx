import { getUpcomingEvents, formatEventDate } from '@/lib/events/queries'

export default async function TestPage() {
  const events = await getUpcomingEvents()

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">Upcoming events (debug)</h1>
      <ul className="space-y-2" aria-label="Upcoming events">
        {events.map((e) => (
          <li key={e.id} className="rounded-lg border p-3">
            <div className="text-muted-foreground text-sm">
              {formatEventDate(e.start_at, 'Asia/Seoul')} KST · {e.type}
            </div>
            <div className="font-medium">
              {e.groups?.name} — {e.title}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
