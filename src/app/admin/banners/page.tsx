import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { BannerAdminGrid } from '@/components/admin/banner-admin-grid'

export const metadata = { title: 'Banners' }

export default async function AdminBannersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) redirect('/')

  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, image_url, image_landscape, banner_url')
    .order('name')

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Banners</h1>
        <p className="text-muted-foreground text-sm">
          Ajuste le cadrage du bandeau d&apos;un groupe (déplace / zoome dans le cadre). Le
          recadrage manuel prime sur l&apos;image automatique.
        </p>
      </div>
      <div className="mt-6">
        <BannerAdminGrid groups={groups ?? []} />
      </div>
    </div>
  )
}
