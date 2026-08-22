import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { requireAdminPage } from '@/lib/auth/require-admin'
import { MemberImageEditor } from '@/components/admin/member-image-editor'

export const metadata = { title: 'Images' }

export default async function AdminImagesPage() {
  await requireAdminPage()
  const supabase = await createClient()

  // `.limit(2000)` ne levait rien : PostgREST re-cape à 1000 et rendait un
  // 206 muet. Tout le bas de l'alphabet (268 membres, de « Sohyun » à
  // « ZZONE ») était donc absent de l'éditeur, donc incorrigeable ici.
  const members = await fetchAllRows<{
    id: string
    stage_name: string
    photo_url: string | null
    photo_source_key: string | null
    groups: { name: string }
  }>((from, to) =>
    supabase
      .from('members')
      .select('id, stage_name, photo_url, photo_source_key, groups!inner(name)')
      .order('stage_name')
      .order('id')
      .range(from, to),
  )
  const rows = members.map((m) => ({
    id: m.id,
    name: m.stage_name,
    group: m.groups.name,
    photo: m.photo_url,
    source: m.photo_source_key,
  }))

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Member images</h1>
        <p className="text-muted-foreground text-sm">
          Colle une URL d’image (fandom, etc.) → self-host + centrage visage à l’affichage. Une
          photo posée ici (« manuel ») n’est plus écrasée par le cron.
        </p>
      </div>
      <div className="mt-6">
        <MemberImageEditor members={rows} />
      </div>
    </div>
  )
}
