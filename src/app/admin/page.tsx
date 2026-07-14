import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'

export const metadata = { title: 'Admin' }

const SECTIONS = [
  {
    href: '/admin/images',
    title: 'Images',
    desc: 'Photo d’un membre par URL (self-host + aperçu).',
  },
  { href: '/admin/events', title: 'Events', desc: 'Corriger un titre MV, masquer un faux event.' },
  { href: '/admin/banners', title: 'Banners', desc: 'Recadrer le bandeau d’un groupe.' },
  { href: '/admin/debuts', title: 'Debuts', desc: 'File de revue des débuts détectés.' },
  {
    href: '/admin/suggestions',
    title: 'Suggestions',
    desc: 'Modérer les events / artistes proposés.',
  },
  { href: '/admin/feedback', title: 'Feedback', desc: 'Retours utilisateurs (idée / bug / data).' },
  { href: '/admin/reports', title: 'Reports', desc: 'Commentaires signalés.' },
]

export default async function AdminHub() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) redirect('/')

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground text-sm">
          Éditeurs ciblés. Le CRUD brut (création / suppression en masse) passe par Supabase Studio.
        </p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="bg-card hover:bg-muted/40 rounded-xl border p-4 transition-colors"
          >
            <p className="font-medium">{s.title}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
