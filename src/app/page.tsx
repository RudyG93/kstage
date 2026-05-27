import { Landing } from '@/components/landing'
import { getGroups } from '@/lib/groups/queries'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const groups = await getGroups()

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <Landing groups={groups} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <div className="text-muted-foreground rounded-xl border p-4 text-sm">
            Sidebar left (TODO)
          </div>
        </aside>
        <div className="order-1 min-w-0 flex-1 lg:order-2">
          <div className="text-muted-foreground rounded-xl border p-4 text-sm">
            Center feed (TODO)
          </div>
        </div>
        <aside className="order-3 shrink-0 lg:w-80">
          <div className="text-muted-foreground rounded-xl border p-4 text-sm">
            Sidebar right (TODO)
          </div>
        </aside>
      </div>
    </div>
  )
}
